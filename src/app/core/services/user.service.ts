import { Injectable } from '@angular/core';
import {
    Firestore,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';
import { User, AuthUser } from '../interfaces';

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private firestore: Firestore;

    constructor(
        private firebaseService: FirebaseService,
    ) {
        this.firestore = this.firebaseService.getFirestore();
    }

    async createOrUpdateUser(authUser: AuthUser): Promise<void> {
        try {
            const userRef = doc(this.firestore, 'users', authUser.uid);
            const userDoc = await getDoc(userRef);

            const userData: Partial<User> = {
                uid: authUser.uid,
                email: authUser.email!,
                displayName: authUser.displayName || undefined,
                photoURL: authUser.photoURL || undefined,
                emailVerified: authUser.emailVerified,
                updatedAt: serverTimestamp()
            };

            if (!userDoc.exists()) {
                await setDoc(userRef, {
                    ...userData,
                    createdAt: serverTimestamp(),
                    preferences: {
                        language: 'en',
                        theme: 'light'
                    },
                    libraryCount: 0
                });
                console.log('New user created in Firestore:', authUser.uid);
            } else {
                await updateDoc(userRef, userData);
                console.log('User updated in Firestore:', authUser.uid);
            }
        } catch (error) {
            console.error('Error creating/updating user:', error);
            throw new Error('Failed to save user data');
        }
    }

    async getUser(uid: string): Promise<User | null> {
        try {
            const userRef = doc(this.firestore, 'users', uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                return userDoc.data() as User;
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error getting user:', error);
            throw new Error('Failed to get user data');
        }
    }

    async updateUserPreferences(uid: string, preferences: Partial<User['preferences']>): Promise<void> {
        try {
            const userRef = doc(this.firestore, 'users', uid);
            await updateDoc(userRef, {
                preferences,
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            console.error('Error updating user preferences:', error);
            throw new Error('Failed to update preferences');
        }
    }

    async updateLibraryCount(uid: string, count: number): Promise<void> {
        try {
            const userRef = doc(this.firestore, 'users', uid);
            await updateDoc(userRef, {
                libraryCount: count,
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            console.error('Error updating library count:', error);
            throw new Error('Failed to update library count');
        }
    }

    async updateDisplayName(uid: string, displayName: string): Promise<void> {
        try {
            const userRef = doc(this.firestore, 'users', uid);
            await updateDoc(userRef, {
                displayName,
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            console.error('Error updating display name:', error);
            throw new Error('Failed to update display name');
        }
    }


    async updateEmail(uid: string, email: string): Promise<void> {
        try {
            const userRef = doc(this.firestore, 'users', uid);
            await updateDoc(userRef, {
                email,
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            console.error('Error updating email in Firestore:', error);
            throw new Error('Failed to update email');
        }
    }

    async updatePhotoURL(uid: string, photoURL: string): Promise<void> {
        try {
            const userRef = doc(this.firestore, 'users', uid);
            await updateDoc(userRef, {
                photoURL,
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            console.error('Error updating photo URL:', error);
            throw new Error('Failed to update photo URL');
        }
    }

    async getUserStats(uid: string): Promise<{
        libraryCount: number;
        accountAge: number;
        lastLoginDays: number;
    }> {
        try {
            const user = await this.getUser(uid);
            if (!user) {
                throw new Error('User not found');
            }

            const now = new Date();
            const createdAt = user.createdAt?.toDate() || now;
            const accountAge = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const lastLoginDays = 0;

            return {
                libraryCount: user.libraryCount || 0,
                accountAge,
                lastLoginDays
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            throw new Error('Failed to get user statistics');
        }
    }

    async updateAccountSettings(uid: string, settings: {
        emailNotifications?: boolean;
        dataSharing?: boolean;
        analyticsOptOut?: boolean;
    }): Promise<void> {
        try {
            const userRef = doc(this.firestore, 'users', uid);
            await updateDoc(userRef, {
                accountSettings: settings,
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            console.error('Error updating account settings:', error);
            throw new Error('Failed to update account settings');
        }
    }
    async deleteUserData(uid: string): Promise<void> {
        try {
            const userRef = doc(this.firestore, 'users', uid);
            await updateDoc(userRef, {
                isDeleted: true,
                deletedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            console.error('Error deleting user data:', error);
            throw new Error('Failed to delete user data');
        }
    }

    async updateUserProfile(uid: string, profile: { displayName?: string; photoURL?: string }): Promise<void> {
        try {
            const userRef = doc(this.firestore, 'users', uid);
            await updateDoc(userRef, {
                ...profile,
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            console.error('Error updating user profile:', error);
            throw new Error('Failed to update profile');
        }
    }
}
