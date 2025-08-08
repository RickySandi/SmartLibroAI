import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-forgot-password',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent implements OnInit, OnDestroy {
    forgotPasswordForm!: FormGroup;
    isLoading = false;
    errorMessage = '';
    successMessage = '';

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
        this.forgotPasswordForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]]
        });

        this.forgotPasswordForm.valueChanges.subscribe(() => {
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
        if (this.forgotPasswordForm.valid && !this.isLoading) {
            this.isLoading = true;
            this.errorMessage = '';
            this.successMessage = '';

            const { email } = this.forgotPasswordForm.value;

            try {
                console.log('Attempting password reset for email:', email);
                await this.authService.resetPassword(email);
                console.log('Password reset email sent successfully');
                this.successMessage = 'Password reset email sent! Please check your inbox and follow the instructions to reset your password.';
                this.forgotPasswordForm.reset();
            } catch (error) {
                console.error('Password reset error:', error);
                this.errorMessage = error instanceof Error ? error.message : 'An error occurred while sending the password reset email.';

                this.forgotPasswordForm.markAllAsTouched();
            } finally {
                this.isLoading = false;
            }
        } else {
            this.forgotPasswordForm.markAllAsTouched();
        }
    }

    getFieldError(fieldName: string): string {
        const field = this.forgotPasswordForm.get(fieldName);
        if (field?.errors && field?.touched) {
            if (field.errors['required']) {
                return 'Email is required.';
            }
            if (field.errors['email']) {
                return 'Please enter a valid email address.';
            }
        }
        return '';
    }

    isFieldInvalid(fieldName: string): boolean {
        const field = this.forgotPasswordForm.get(fieldName);
        return !!(field?.errors && field?.touched);
    }
}
