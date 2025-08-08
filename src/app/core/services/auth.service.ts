import { Injectable } from '@angular/core';
import {
    Auth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User,
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile,
    setPersistence,
    browserSessionPersistence,
    browserLocalPersistence
} from 'firebase/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthUser } from '../interfaces';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private auth!: Auth;
    private userSubject = new BehaviorSubject<AuthUser | null>(null);
    private loadingSubject = new BehaviorSubject<boolean>(true);

    public user$ = this.userSubject.asObservable();
    public loading$ = this.loadingSubject.asObservable();

    constructor() { }

    setAuth(auth: Auth): void {
        this.auth = auth;
        this.initAuthListener();
    }

    get authInstance(): Auth {
        return this.auth;
    }

    private initAuthListener(): void {
        onAuthStateChanged(this.auth, (user: User | null) => {
            if (user) {
                const authUser: AuthUser = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    emailVerified: user.emailVerified,
                    providerId: user.providerId,
                    providerData: user.providerData
                };
                this.userSubject.next(authUser);
            } else {
                this.userSubject.next(null);
            }
            this.loadingSubject.next(false);
        });
    }

    async signIn(email: string, password: string, rememberMe: boolean = true): Promise<void> {
        try {
            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(this.auth, persistence);

            console.log('Auth persistence set to:', rememberMe ? 'local' : 'session');
            await signInWithEmailAndPassword(this.auth, email, password);
        } catch (error) {
            throw this.handleAuthError(error);
        }
    }

    async signUp(email: string, password: string, displayName?: string): Promise<void> {
        try {
            const result = await createUserWithEmailAndPassword(this.auth, email, password);

            if (displayName && result.user) {
                await updateProfile(result.user, { displayName });
            }
        } catch (error) {
            throw this.handleAuthError(error);
        }
    }

    async signInWithGoogle(rememberMe: boolean = true): Promise<void> {
        try {
            console.log('Attempting Google sign-in...');

            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(this.auth, persistence);
            console.log('Auth persistence set to:', rememberMe ? 'local' : 'session');

            const provider = new GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            const result = await signInWithPopup(this.auth, provider);
            console.log('Google sign-in successful:', result.user?.email);
        } catch (error) {
            console.error('Google sign-in error:', error);
            throw this.handleAuthError(error);
        }
    }

    async signInWithGitHub(rememberMe: boolean = true): Promise<void> {
        try {
            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(this.auth, persistence);
            console.log('Auth persistence set to:', rememberMe ? 'local' : 'session');

            const provider = new GithubAuthProvider();
            provider.addScope('user:email');
            await signInWithPopup(this.auth, provider);
        } catch (error) {
            throw this.handleAuthError(error);
        }
    }

    async signOut(): Promise<void> {
        try {
            await signOut(this.auth);
        } catch (error) {
            throw this.handleAuthError(error);
        }
    } async resetPassword(email: string): Promise<void> {
        try {
            console.log('Starting password reset process...');
            console.log('Email:', email);
            console.log('Auth instance available:', !!this.auth);
            console.log('Firebase project ID:', this.auth?.app?.options?.projectId);

            if (!this.auth) {
                throw new Error('Firebase Auth not initialized');
            }

            if (!email || !email.trim()) {
                throw new Error('Email is required');
            }

            console.log('Attempting to send password reset email to:', email);

            await sendPasswordResetEmail(this.auth, email);

            console.log('✅ Password reset email sent successfully to:', email);
            console.log('Please check your email inbox and spam folder');

        } catch (error: any) {
            console.error('❌ Error sending password reset email:', error);
            console.error('Error details:', {
                code: error?.code || 'unknown',
                message: error?.message || 'Unknown error',
                email: email,
                authAvailable: !!this.auth
            });
            throw this.handleAuthError(error);
        }
    }

    async testPasswordReset(email: string): Promise<string> {
        try {

            try {
                await sendPasswordResetEmail(this.auth, email);
                return `✅ Password reset email sent successfully to ${email}. Check your inbox and spam folder.`;
            } catch (error: any) {
                if (error.code === 'auth/user-not-found') {
                    return `⚠️ No account found with email ${email}. Please sign up first.`;
                }
                throw error;
            }
        } catch (error: any) {
            console.error('Test failed:', error);
            return `❌ Failed to send email: ${error.message || 'Unknown error'}`;
        }
    }

    async updatePassword(newPassword: string): Promise<void> {
        try {
            if (!this.auth.currentUser) {
                throw new Error('No user is currently signed in');
            }

            const { updatePassword } = await import('firebase/auth');
            await updatePassword(this.auth.currentUser, newPassword);

        } catch (error) {
            console.error('Error updating password:', error);
            throw this.handleAuthError(error);
        }
    }

    async updateUserProfile(profile: { displayName?: string; photoURL?: string }): Promise<void> {
        try {
            if (!this.auth.currentUser) {
                throw new Error('No user is currently signed in');
            }

            await updateProfile(this.auth.currentUser, profile);

            const currentUser = this.userSubject.value;
            if (currentUser) {
                this.userSubject.next({
                    ...currentUser,
                    displayName: profile.displayName || currentUser.displayName,
                    photoURL: profile.photoURL || currentUser.photoURL
                });
            }

        } catch (error) {
            console.error('Error updating profile:', error);
            throw this.handleAuthError(error);
        }
    }

    async updateEmail(newEmail: string): Promise<void> {
        try {
            if (!this.auth.currentUser) {
                throw new Error('No user is currently signed in');
            }

            const { updateEmail } = await import('firebase/auth');
            await updateEmail(this.auth.currentUser, newEmail);

            const currentUser = this.userSubject.value;
            if (currentUser) {
                this.userSubject.next({
                    ...currentUser,
                    email: newEmail
                });
            }

        } catch (error) {
            console.error('Error updating email:', error);
            throw this.handleAuthError(error);
        }
    }

    async reauthenticate(password: string): Promise<void> {
        try {
            if (!this.auth.currentUser || !this.auth.currentUser.email) {
                throw new Error('No user is currently signed in');
            }

            const { EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
            const credential = EmailAuthProvider.credential(this.auth.currentUser.email, password);
            await reauthenticateWithCredential(this.auth.currentUser, credential);

            console.log('Re-authentication successful');
        } catch (error) {
            console.error('Error re-authenticating:', error);
            throw this.handleAuthError(error);
        }
    }

    async sendEmailVerification(): Promise<void> {
        try {
            if (!this.auth.currentUser) {
                throw new Error('No user is currently signed in');
            }

            const { sendEmailVerification } = await import('firebase/auth');
            await sendEmailVerification(this.auth.currentUser);
            console.log('Email verification sent');
        } catch (error) {
            console.error('Error sending email verification:', error);
            throw this.handleAuthError(error);
        }
    }

    async deleteAccount(): Promise<void> {
        try {
            if (!this.auth.currentUser) {
                throw new Error('No user is currently signed in');
            }

            const { deleteUser } = await import('firebase/auth');
            await deleteUser(this.auth.currentUser);

        } catch (error) {
            console.error('Error deleting account:', error);
            throw this.handleAuthError(error);
        }
    }

    async confirmPasswordReset(actionCode: string, newPassword: string): Promise<void> {
        try {
            if (!this.auth) {
                throw new Error('Firebase Auth not initialized');
            }

            const { confirmPasswordReset } = await import('firebase/auth');
            await confirmPasswordReset(this.auth, actionCode, newPassword);

        } catch (error) {
            console.error('Error confirming password reset:', error);
            throw this.handleAuthError(error);
        }
    }

    async verifyPasswordResetCode(actionCode: string): Promise<string> {
        try {
            if (!this.auth) {
                throw new Error('Firebase Auth not initialized');
            }

            const { verifyPasswordResetCode } = await import('firebase/auth');
            const email = await verifyPasswordResetCode(this.auth, actionCode);
            console.log('Password reset code verified for email:', email);
            return email;
        } catch (error) {
            console.error('Error verifying password reset code:', error);
            throw this.handleAuthError(error);
        }
    }

    private handleAuthError(error: any): Error {
        let message = 'An authentication error occurred.';

        switch (error.code) {
            case 'auth/user-not-found':
                message = 'No account found with this email address.';
                break;
            case 'auth/wrong-password':
                message = 'Incorrect password.';
                break;
            case 'auth/email-already-in-use':
                message = 'An account with this email already exists.';
                break;
            case 'auth/weak-password':
                message = 'Password should be at least 6 characters.';
                break;
            case 'auth/invalid-email':
                message = 'Invalid email address.';
                break;
            case 'auth/popup-closed-by-user':
                message = 'Sign-in popup was closed before completion.';
                break;
            case 'auth/network-request-failed':
                message = 'Network error. Please check your connection.';
                break;
            case 'auth/too-many-requests':
                message = 'Too many requests. Please wait a moment before trying again.';
                break;
            case 'auth/invalid-action-code':
                message = 'Invalid or expired password reset link.';
                break;
            case 'auth/expired-action-code':
                message = 'Password reset link has expired. Please request a new one.';
                break;
            case 'auth/user-disabled':
                message = 'This account has been disabled.';
                break;
            case 'auth/missing-email':
                message = 'Email address is required.';
                break;
            case 'auth/invalid-continue-uri':
                message = 'Invalid configuration. Please contact support.';
                break;
            case 'auth/unauthorized-continue-uri':
                message = 'Unauthorized domain. Please contact support.';
                break;
            default:
                console.error('Unhandled auth error:', error);
                message = error.message || message;
        }

        return new Error(message);
    }

    getCurrentUser(): AuthUser | null {
        return this.userSubject.value;
    }

    isAuthenticated(): boolean {
        return this.userSubject.value !== null;
    }

    isEmailPasswordUser(): boolean {
        const user = this.auth.currentUser;
        if (!user) return false;

        return user.providerData.some(provider => provider.providerId === 'password');
    }

    isGoogleUser(): boolean {
        const user = this.auth.currentUser;
        if (!user) return false;

        return user.providerData.some(provider => provider.providerId === 'google.com');
    }

    isGitHubUser(): boolean {
        const user = this.auth.currentUser;
        if (!user) return false;

        return user.providerData.some(provider => provider.providerId === 'github.com');
    }

    getUserProviders(): string[] {
        const user = this.auth.currentUser;
        if (!user) return [];

        return user.providerData.map(provider => provider.providerId);
    }

    canChangePassword(): boolean {
        return this.isEmailPasswordUser();
    }

    canChangeEmail(): boolean {
        return this.isEmailPasswordUser();
    }

    async linkEmailPassword(email: string, password: string): Promise<void> {
        try {
            if (!this.auth.currentUser) {
                throw new Error('No user is currently signed in');
            }

            const { EmailAuthProvider, linkWithCredential } = await import('firebase/auth');
            const credential = EmailAuthProvider.credential(email, password);
            await linkWithCredential(this.auth.currentUser, credential);

            console.log('Email/password provider linked successfully');
        } catch (error) {
            console.error('Error linking email/password provider:', error);
            throw this.handleAuthError(error);
        }
    }

    async unlinkProvider(providerId: string): Promise<void> {
        try {
            if (!this.auth.currentUser) {
                throw new Error('No user is currently signed in');
            }

            const providers = this.getUserProviders();
            if (providers.length <= 1) {
                throw new Error('Cannot unlink the only authentication provider');
            }

            const { unlink } = await import('firebase/auth');
            await unlink(this.auth.currentUser, providerId);

        } catch (error) {
            console.error('Error unlinking provider:', error);
            throw this.handleAuthError(error);
        }
    }

    getProviderUserInfo(): { [providerId: string]: any } {
        const user = this.auth.currentUser;
        if (!user) return {};

        const providerInfo: { [providerId: string]: any } = {};
        user.providerData.forEach(provider => {
            providerInfo[provider.providerId] = {
                uid: provider.uid,
                email: provider.email,
                displayName: provider.displayName,
                photoURL: provider.photoURL
            };
        });

        return providerInfo;
    }
}
