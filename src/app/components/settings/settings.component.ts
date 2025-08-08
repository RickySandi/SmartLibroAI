import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { AuthUser, User } from '../../core/interfaces';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {
    profileForm!: FormGroup;
    passwordForm!: FormGroup;
    emailForm!: FormGroup;
    linkAccountForm!: FormGroup;

    currentUser: AuthUser | null = null;
    userProfile: User | null = null;

    isLoading = false;
    profileLoading = false;
    passwordLoading = false;
    emailLoading = false;
    linkAccountLoading = false;

    successMessage = '';
    errorMessage = '';

    showPasswordForm = false;
    showEmailForm = false;
    showLinkAccountForm = false;
    showDeleteConfirmation = false;

    // Provider-specific properties
    isEmailPasswordUser = false;
    isGoogleUser = false;
    isGitHubUser = false;
    userProviders: string[] = [];
    canChangePassword = false;
    canChangeEmail = false;

    private destroy$ = new Subject<void>();

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private userService: UserService,
        private router: Router
    ) {
        this.initializeForms();
    }

    ngOnInit(): void {
        this.loadCurrentUser();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initializeForms(): void {
        this.profileForm = this.fb.group({
            displayName: ['', [Validators.required, Validators.minLength(2)]],
            photoURL: ['', [Validators.pattern('https?://.+')]]
        });

        this.passwordForm = this.fb.group({
            currentPassword: ['', [Validators.required]],
            newPassword: ['', [Validators.required, Validators.minLength(6)]],
            confirmPassword: ['', [Validators.required]]
        }, { validators: this.passwordMatchValidator });

        this.emailForm = this.fb.group({
            newEmail: ['', [Validators.required, Validators.email]],
            currentPassword: ['', [Validators.required]]
        });

        this.linkAccountForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6)]],
            confirmPassword: ['', [Validators.required]]
        }, { validators: this.passwordMatchValidator });
    }

    private passwordMatchValidator(form: FormGroup) {
        const newPassword = form.get('newPassword');
        const confirmPassword = form.get('confirmPassword');

        if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
            confirmPassword.setErrors({ passwordMismatch: true });
            return { passwordMismatch: true };
        }

        return null;
    }

    private async loadCurrentUser(): Promise<void> {
        try {
            this.isLoading = true;

            this.authService.user$
                .pipe(takeUntil(this.destroy$))
                .subscribe(async (user) => {
                    if (user) {
                        this.currentUser = user;

                        // Check provider information
                        this.updateProviderInfo();

                        // Load user profile from Firestore
                        try {
                            this.userProfile = await this.userService.getUser(user.uid);
                            this.populateProfileForm();
                        } catch (error) {
                            console.error('Error loading user profile:', error);
                        }
                    } else {
                        this.router.navigate(['/login']);
                    }
                });

        } catch (error) {
            console.error('Error loading user data:', error);
            this.errorMessage = 'Failed to load user data';
        } finally {
            this.isLoading = false;
        }
    }

    private populateProfileForm(): void {
        if (this.currentUser) {
            this.profileForm.patchValue({
                displayName: this.currentUser.displayName || '',
                photoURL: this.currentUser.photoURL || ''
            });
        }
    }

    async updateProfile(): Promise<void> {
        if (this.profileForm.invalid || !this.currentUser) return;

        try {
            this.profileLoading = true;
            this.clearMessages();

            const { displayName, photoURL } = this.profileForm.value;

            // Update Firebase Auth profile
            await this.authService.updateUserProfile({ displayName, photoURL });

            // Update Firestore user document
            if (displayName !== this.currentUser.displayName) {
                await this.userService.updateDisplayName(this.currentUser.uid, displayName);
            }

            if (photoURL && photoURL !== this.currentUser.photoURL) {
                await this.userService.updatePhotoURL(this.currentUser.uid, photoURL);
            }

            this.successMessage = 'Profile updated successfully!';
            this.clearMessageAfterDelay();

        } catch (error) {
            console.error('Error updating profile:', error);
            this.errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
            this.clearMessageAfterDelay();
        } finally {
            this.profileLoading = false;
        }
    }

    async updatePassword(): Promise<void> {
        if (this.passwordForm.invalid || !this.currentUser) return;

        // Check if user can change password (only email/password users)
        if (!this.canChangePassword) {
            this.errorMessage = 'Password change is not available for social authentication accounts. Please manage your password through your authentication provider.';
            this.clearMessageAfterDelay();
            return;
        }

        try {
            this.passwordLoading = true;
            this.clearMessages();

            const { currentPassword, newPassword } = this.passwordForm.value;

            // Re-authenticate user first
            await this.authService.reauthenticate(currentPassword);

            // Update password
            await this.authService.updatePassword(newPassword);

            this.successMessage = 'Password updated successfully!';
            this.passwordForm.reset();
            this.showPasswordForm = false;
            this.clearMessageAfterDelay();

        } catch (error) {
            console.error('Error updating password:', error);
            this.errorMessage = error instanceof Error ? error.message : 'Failed to update password';
            this.clearMessageAfterDelay();
        } finally {
            this.passwordLoading = false;
        }
    }

    async updateEmail(): Promise<void> {
        if (this.emailForm.invalid || !this.currentUser) return;

        // Check if user can change email
        if (!this.canChangeEmail) {
            this.errorMessage = 'Email changes are not available for your account type. Please use your authentication provider to change your email.';
            this.clearMessageAfterDelay();
            return;
        }

        try {
            this.emailLoading = true;
            this.clearMessages();

            const { newEmail, currentPassword } = this.emailForm.value;

            // Re-authenticate user first
            await this.authService.reauthenticate(currentPassword);

            // Update email in Firebase Auth
            await this.authService.updateEmail(newEmail);

            // Update email in Firestore
            await this.userService.updateEmail(this.currentUser.uid, newEmail);

            this.successMessage = 'Email updated successfully!';
            this.emailForm.reset();
            this.showEmailForm = false;
            this.clearMessageAfterDelay();

        } catch (error) {
            console.error('Error updating email:', error);
            this.errorMessage = error instanceof Error ? error.message : 'Failed to update email';
            this.clearMessageAfterDelay();
        } finally {
            this.emailLoading = false;
        }
    }

    async sendPasswordResetEmail(): Promise<void> {
        if (!this.currentUser?.email) return;

        // Check if user can change password (only email/password users)
        if (!this.canChangePassword) {
            this.errorMessage = 'Password reset is not available for social authentication accounts. Please manage your password through your authentication provider.';
            this.clearMessageAfterDelay();
            return;
        }

        try {
            this.clearMessages();
            await this.authService.resetPassword(this.currentUser.email);
            this.successMessage = 'Password reset email sent! Check your inbox.';
            this.clearMessageAfterDelay();
        } catch (error) {
            console.error('Error sending password reset:', error);
            this.errorMessage = error instanceof Error ? error.message : 'Failed to send password reset email';
            this.clearMessageAfterDelay();
        }
    }

    async sendEmailVerification(): Promise<void> {
        try {
            this.clearMessages();
            await this.authService.sendEmailVerification();
            this.successMessage = 'Verification email sent! Check your inbox.';
            this.clearMessageAfterDelay();
        } catch (error) {
            console.error('Error sending verification email:', error);
            this.errorMessage = error instanceof Error ? error.message : 'Failed to send verification email';
            this.clearMessageAfterDelay();
        }
    }

    async deleteAccount(): Promise<void> {
        if (!this.currentUser) return;

        try {
            this.clearMessages();

            // Mark user data as deleted in Firestore
            await this.userService.deleteUserData(this.currentUser.uid);

            // Delete Firebase Auth account
            await this.authService.deleteAccount();

            // Navigate to home page
            this.router.navigate(['/']);

        } catch (error) {
            console.error('Error deleting account:', error);
            this.errorMessage = error instanceof Error ? error.message : 'Failed to delete account. You may need to sign in again.';
            this.clearMessageAfterDelay();
        }
    }

    togglePasswordForm(): void {
        this.showPasswordForm = !this.showPasswordForm;
        if (!this.showPasswordForm) {
            this.passwordForm.reset();
        }
    }

    toggleEmailForm(): void {
        this.showEmailForm = !this.showEmailForm;
        if (!this.showEmailForm) {
            this.emailForm.reset();
        }
    }

    toggleDeleteConfirmation(): void {
        this.showDeleteConfirmation = !this.showDeleteConfirmation;
    }

    private clearMessages(): void {
        this.successMessage = '';
        this.errorMessage = '';
    }

    private clearMessageAfterDelay(): void {
        setTimeout(() => {
            this.clearMessages();
        }, 5000);
    }

    // Form validation helpers
    isFieldInvalid(formName: string, fieldName: string): boolean {
        const form = this.getForm(formName);
        const field = form?.get(fieldName);
        return !!(field && field.invalid && (field.dirty || field.touched));
    }

    getFieldError(formName: string, fieldName: string): string {
        const form = this.getForm(formName);
        const field = form?.get(fieldName);

        if (field?.errors) {
            if (field.errors['required']) return `${this.getFieldLabel(fieldName)} is required`;
            if (field.errors['email']) return 'Please enter a valid email address';
            if (field.errors['minlength']) return `${this.getFieldLabel(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters`;
            if (field.errors['pattern']) return 'Please enter a valid URL starting with http:// or https://';
            if (field.errors['passwordMismatch']) return 'Passwords do not match';
        }

        return '';
    }

    private getForm(formName: string): FormGroup | null {
        switch (formName) {
            case 'profile': return this.profileForm;
            case 'password': return this.passwordForm;
            case 'email': return this.emailForm;
            case 'linkAccount': return this.linkAccountForm;
            default: return null;
        }
    }

    private markFormGroupTouched(formGroup: FormGroup): void {
        Object.keys(formGroup.controls).forEach(key => {
            const control = formGroup.get(key);
            control?.markAsTouched();

            if (control instanceof FormGroup) {
                this.markFormGroupTouched(control);
            }
        });
    }

    private showSuccessMessage(message: string): void {
        this.successMessage = message;
        this.errorMessage = '';
        this.clearMessageAfterDelay();
    }

    private showErrorMessage(message: string): void {
        this.errorMessage = message;
        this.successMessage = '';
        this.clearMessageAfterDelay();
    }

    private getFieldLabel(fieldName: string): string {
        const labels: { [key: string]: string } = {
            displayName: 'Display Name',
            photoURL: 'Photo URL',
            currentPassword: 'Current Password',
            newPassword: 'New Password',
            confirmPassword: 'Confirm Password',
            newEmail: 'New Email'
        };
        return labels[fieldName] || fieldName;
    }

    private updateProviderInfo(): void {
        this.isEmailPasswordUser = this.authService.isEmailPasswordUser();
        this.isGoogleUser = this.authService.isGoogleUser();
        this.isGitHubUser = this.authService.isGitHubUser();
        this.userProviders = this.authService.getUserProviders();
        this.canChangePassword = this.authService.canChangePassword();
        this.canChangeEmail = this.authService.canChangeEmail();

        console.log('Provider info:', {
            isEmailPasswordUser: this.isEmailPasswordUser,
            isGoogleUser: this.isGoogleUser,
            isGitHubUser: this.isGitHubUser,
            userProviders: this.userProviders,
            canChangePassword: this.canChangePassword,
            canChangeEmail: this.canChangeEmail
        });
    }

    getProviderDisplayName(providerId: string): string {
        switch (providerId) {
            case 'password': return 'Email/Password';
            case 'google.com': return 'Google';
            case 'github.com': return 'GitHub';
            default: return providerId;
        }
    }

    async linkEmailPasswordAccount(): Promise<void> {
        if (this.linkAccountForm.invalid) {
            this.markFormGroupTouched(this.linkAccountForm);
            return;
        }

        try {
            this.linkAccountLoading = true;
            this.clearMessages();

            const formData = this.linkAccountForm.value;

            await this.authService.linkEmailPassword(formData.email, formData.password);

            this.showSuccessMessage('Email/password account linked successfully! You can now change your password and email.');
            this.showLinkAccountForm = false;
            this.linkAccountForm.reset();
            this.updateProviderInfo(); // Refresh provider info

        } catch (error) {
            console.error('Link account error:', error);
            this.showErrorMessage(error instanceof Error ? error.message : 'Failed to link account.');
        } finally {
            this.linkAccountLoading = false;
        }
    }

    async unlinkProvider(providerId: string): Promise<void> {
        if (!confirm(`Are you sure you want to unlink your ${this.getProviderDisplayName(providerId)} account?`)) {
            return;
        }

        try {
            this.isLoading = true;
            this.clearMessages();

            await this.authService.unlinkProvider(providerId);

            this.showSuccessMessage(`${this.getProviderDisplayName(providerId)} account unlinked successfully.`);
            this.updateProviderInfo(); // Refresh provider info

        } catch (error) {
            console.error('Unlink provider error:', error);
            this.showErrorMessage(error instanceof Error ? error.message : 'Failed to unlink provider.');
        } finally {
            this.isLoading = false;
        }
    }
}
