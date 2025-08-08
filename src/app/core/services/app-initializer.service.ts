import { Injectable } from '@angular/core';
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';

@Injectable({
    providedIn: 'root'
})
export class AppInitializerService {

    constructor(
        private firebaseService: FirebaseService,
        private authService: AuthService,
        private userService: UserService
    ) { }

    async initializeApp(): Promise<void> {
        try {
            const auth = this.firebaseService.getAuth();
            this.authService.setAuth(auth);

            this.authService.user$.subscribe(async (user) => {
                if (user) {
                    try {
                        await this.userService.createOrUpdateUser(user);
                    } catch (error) {
                        console.error('Error creating/updating user:', error);
                    }
                }
            });

        } catch (error) {
            console.error('Error initializing app:', error);
            throw error;
        }
    }
}
