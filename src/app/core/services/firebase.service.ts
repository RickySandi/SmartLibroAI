import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class FirebaseService {
    private app: FirebaseApp;
    private auth: Auth;
    private firestore: Firestore;
    private initialized = false;

    constructor() {
        this.app = initializeApp(environment.firebaseConfig);
        this.auth = getAuth(this.app);
        this.firestore = getFirestore(this.app);
    }

    async initializeApp(authService?: any, userService?: any): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            if (authService) {
                authService.setAuth(this.auth);

                if (userService) {
                    authService.user$.subscribe(async (user: any) => {
                        if (user) {
                            try {
                                await userService.createOrUpdateUser(user);
                            } catch (error) {
                                console.error('Error creating/updating user:', error);
                            }
                        }
                    });
                }
            }

            this.initialized = true;

        } catch (error) {
            console.error('Error initializing Firebase:', error);
            throw error;
        }
    }

    getAuth(): Auth {
        return this.auth;
    }

    getFirestore(): Firestore {
        return this.firestore;
    }

    getApp(): FirebaseApp {
        return this.app;
    }

    isInitialized(): boolean {
        return this.initialized;
    }
}
