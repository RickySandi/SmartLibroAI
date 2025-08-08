import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-signup',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './signup.component.html'
})
export class SignupComponent implements OnInit, OnDestroy {
    signupForm!: FormGroup;
    isLoading = false;
    errorMessage = '';
    showPassword = false;
    showConfirmPassword = false;

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
        this.signupForm = this.fb.group({
            displayName: ['', [Validators.required, Validators.minLength(2)]],
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6), this.capitalLetterValidator]],
            confirmPassword: ['', [Validators.required]]
        }, {
            validators: this.passwordMatchValidator
        });

        this.signupForm.valueChanges.subscribe(() => {
            if (this.errorMessage) {
                this.errorMessage = '';
            }
        });
    }

    private capitalLetterValidator(control: any) {
        const value = control.value;
        if (!value) return null;

        const hasCapitalLetter = /[A-Z]/.test(value);
        return hasCapitalLetter ? null : { noCapitalLetter: true };
    }

    private passwordMatchValidator(group: FormGroup) {
        const password = group.get('password');
        const confirmPassword = group.get('confirmPassword');

        if (password && confirmPassword && password.value !== confirmPassword.value) {
            confirmPassword.setErrors({ passwordMismatch: true });
            return { passwordMismatch: true };
        }

        if (confirmPassword?.errors?.['passwordMismatch']) {
            delete confirmPassword.errors['passwordMismatch'];
            if (Object.keys(confirmPassword.errors).length === 0) {
                confirmPassword.setErrors(null);
            }
        }

        return null;
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
        if (this.signupForm.valid && !this.isLoading) {
            this.isLoading = true;
            this.errorMessage = '';

            const { displayName, email, password } = this.signupForm.value;

            try {
                await this.authService.signUp(email, password, displayName);

            } catch (error) {
                console.error('Email/password sign-up error:', error);
                this.errorMessage = error instanceof Error ? error.message : 'An error occurred during sign up.';

                this.signupForm.markAllAsTouched();
            } finally {
                this.isLoading = false;
            }
        } else {
            this.signupForm.markAllAsTouched();
        }
    }

    async signUpWithGoogle(): Promise<void> {
        if (this.isLoading) return;

        this.isLoading = true;
        this.errorMessage = '';

        try {
            await this.authService.signInWithGoogle();

        } catch (error) {
            this.errorMessage = error instanceof Error ? error.message : 'An error occurred during Google sign up.';
        } finally {
            this.isLoading = false;
        }
    }

    async signUpWithGitHub(): Promise<void> {
        if (this.isLoading) return;

        this.isLoading = true;
        this.errorMessage = '';

        try {
            await this.authService.signInWithGitHub();

        } catch (error) {
            this.errorMessage = error instanceof Error ? error.message : 'An error occurred during GitHub sign up.';
        } finally {
            this.isLoading = false;
        }
    }

    togglePasswordVisibility(): void {
        this.showPassword = !this.showPassword;
    }

    toggleConfirmPasswordVisibility(): void {
        this.showConfirmPassword = !this.showConfirmPassword;
    }

    getFieldError(fieldName: string): string {
        const field = this.signupForm.get(fieldName);
        if (field?.errors && field?.touched) {
            if (field.errors['required']) {
                return `${this.getFieldDisplayName(fieldName)} is required.`;
            }
            if (field.errors['email']) {
                return 'Please enter a valid email address.';
            }
            if (field.errors['minlength']) {
                const requiredLength = field.errors['minlength'].requiredLength;
                if (fieldName === 'password') {
                    return `Password must be at least ${requiredLength} characters.`;
                }
                return `${this.getFieldDisplayName(fieldName)} must be at least ${requiredLength} characters.`;
            }
            if (field.errors['noCapitalLetter']) {
                return 'Password must contain at least one capital letter.';
            }
            if (field.errors['passwordMismatch']) {
                return 'Passwords do not match.';
            }
        }
        return '';
    }

    private getFieldDisplayName(fieldName: string): string {
        const displayNames: { [key: string]: string } = {
            displayName: 'Full name',
            email: 'Email',
            password: 'Password',
            confirmPassword: 'Confirm password'
        };
        return displayNames[fieldName] || fieldName;
    }

    isFieldInvalid(fieldName: string): boolean {
        const field = this.signupForm.get(fieldName);
        return !!(field?.errors && field?.touched);
    }

    get hasMinLength(): boolean {
        const password = this.signupForm.get('password');
        return !!(password && password.value && password.value.length >= 6);
    }

    get hasCapitalLetter(): boolean {
        const password = this.signupForm.get('password');
        return !!(password && password.value && /[A-Z]/.test(password.value));
    }
}
