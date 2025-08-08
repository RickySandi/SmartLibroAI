import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit, OnDestroy {
    loginForm!: FormGroup;
    isLoading = false;
    errorMessage = '';
    showPassword = false;

    private destroy$ = new Subject<void>();

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.initializeForm();
        this.checkAuthState();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initializeForm(): void {
        this.loginForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6)]],
            rememberMe: [false]
        });

        // Add real-time validation feedback
        this.loginForm.valueChanges.subscribe(() => {
            if (this.errorMessage) {
                this.errorMessage = '';
            }
        });
    }

    private checkAuthState(): void {
        this.authService.user$
            .pipe(takeUntil(this.destroy$))
            .subscribe(user => {
                if (user) {
                    this.router.navigate(['/dashboard']);
                }
            });
    }

    async onSubmit(): Promise<void> {
        if (this.loginForm.valid && !this.isLoading) {
            this.isLoading = true;
            this.errorMessage = '';

            const { email, password, rememberMe } = this.loginForm.value;

            try {
                console.log('Attempting email/password sign-in...');
                console.log('Remember me:', rememberMe);
                await this.authService.signIn(email, password, rememberMe);
                console.log('Email/password sign-in successful');

            } catch (error) {
                console.error('Email/password sign-in error:', error);
                this.errorMessage = error instanceof Error ? error.message : 'An error occurred during sign in.';

                this.loginForm.markAllAsTouched();
            } finally {
                this.isLoading = false;
            }
        } else {
            this.loginForm.markAllAsTouched();
        }
    }

    async signInWithGoogle(): Promise<void> {
        if (this.isLoading) return;

        this.isLoading = true;
        this.errorMessage = '';

        try {
            const rememberMe = this.loginForm.get('rememberMe')?.value || false;
            await this.authService.signInWithGoogle(rememberMe);

        } catch (error) {
            this.errorMessage = error instanceof Error ? error.message : 'An error occurred during Google sign in.';
        } finally {
            this.isLoading = false;
        }
    }

    async signInWithGitHub(): Promise<void> {
        if (this.isLoading) return;

        this.isLoading = true;
        this.errorMessage = '';

        try {
            const rememberMe = this.loginForm.get('rememberMe')?.value || false;
            await this.authService.signInWithGitHub(rememberMe);

        } catch (error) {
            this.errorMessage = error instanceof Error ? error.message : 'An error occurred during GitHub sign in.';
        } finally {
            this.isLoading = false;
        }
    }

    togglePasswordVisibility(): void {
        this.showPassword = !this.showPassword;
    }

    togglePassword(): void {
        this.showPassword = !this.showPassword;
    }

    async signInWithGithub(): Promise<void> {
        const rememberMe = this.loginForm.get('rememberMe')?.value || false;
        return this.authService.signInWithGitHub(rememberMe);
    }

    getFieldError(fieldName: string): string {
        const field = this.loginForm.get(fieldName);
        if (field?.errors && field?.touched) {
            if (field.errors['required']) {
                return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required.`;
            }
            if (field.errors['email']) {
                return 'Please enter a valid email address.';
            }
            if (field.errors['minlength']) {
                return `Password must be at least ${field.errors['minlength'].requiredLength} characters.`;
            }
        }
        return '';
    }

    isFieldInvalid(fieldName: string): boolean {
        const field = this.loginForm.get(fieldName);
        return !!(field?.errors && field?.touched);
    }
}
