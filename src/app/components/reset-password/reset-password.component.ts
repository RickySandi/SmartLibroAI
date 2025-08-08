import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-reset-password',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './reset-password.component.html',
    styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit {
    resetForm!: FormGroup;

    isLoading = false;
    isVerifying = true;
    isSubmitting = false;
    hasError = false;
    isSuccess = false;

    showPassword = false;
    showConfirmPassword = false;

    successMessage = '';
    errorMessage = '';
    submitError = '';

    email = '';
    actionCode = '';
    mode = '';

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private router: Router,
        private route: ActivatedRoute
    ) {
        this.initializeForm();
    }

    ngOnInit(): void {
        this.extractUrlParameters();
    }

    private initializeForm(): void {
        this.resetForm = this.fb.group({
            newPassword: ['', [Validators.required, Validators.minLength(6), this.capitalLetterValidator]],
            confirmPassword: ['', [Validators.required]]
        }, { validators: this.passwordMatchValidator });
    }

    private capitalLetterValidator(control: any) {
        const value = control.value;
        if (!value) return null;

        const hasCapitalLetter = /[A-Z]/.test(value);
        return hasCapitalLetter ? null : { noCapitalLetter: true };
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

    private extractUrlParameters(): void {
        this.route.queryParams.subscribe(params => {
            this.mode = params['mode'];
            this.actionCode = params['oobCode'];

            if (this.mode !== 'resetPassword' || !this.actionCode) {
                this.hasError = true;
                this.errorMessage = 'Invalid password reset link. Please request a new password reset.';
                this.isLoading = false;
                return;
            }

            this.verifyResetCode();
        });
    }

    private async verifyResetCode(): Promise<void> {
        try {
            this.isVerifying = true;
            this.clearMessages();

            this.email = await this.authService.verifyPasswordResetCode(this.actionCode);

            this.isVerifying = false;

        } catch (error) {
            console.error('Error verifying reset code:', error);
            this.isLoading = false;
            this.hasError = true;

            if (error instanceof Error) {
                if (error.message.includes('expired')) {
                    this.errorMessage = 'This password reset link has expired. Please request a new password reset.';
                } else if (error.message.includes('invalid')) {
                    this.errorMessage = 'Invalid password reset link. Please request a new password reset.';
                } else {
                    this.errorMessage = error.message;
                }
            } else {
                this.errorMessage = 'Failed to verify password reset link. Please try again.';
            }
        }
    }

    async resetPassword(): Promise<void> {
        if (this.resetForm.invalid || !this.actionCode) {
            return;
        }

        try {
            this.isSubmitting = true;
            this.clearMessages();

            const { newPassword } = this.resetForm.value;

            await this.authService.confirmPasswordReset(this.actionCode, newPassword);

            this.isSuccess = true;
            this.successMessage = 'Password has been reset successfully! You can now sign in with your new password.';

            setTimeout(() => {
                this.router.navigate(['/login'], {
                    queryParams: { message: 'Password reset successful. Please sign in with your new password.' }
                });
            }, 3000);

        } catch (error) {
            console.error('Error resetting password:', error);

            if (error instanceof Error) {
                if (error.message.includes('weak-password')) {
                    this.submitError = 'Password is too weak. Please choose a stronger password.';
                } else if (error.message.includes('expired')) {
                    this.submitError = 'This password reset link has expired. Please request a new password reset.';
                } else if (error.message.includes('invalid')) {
                    this.submitError = 'Invalid password reset link. Please request a new password reset.';
                } else {
                    this.submitError = error.message;
                }
            } else {
                this.submitError = 'Failed to reset password. Please try again.';
            }
        } finally {
            this.isSubmitting = false;
        }
    }

    private clearMessages(): void {
        this.successMessage = '';
        this.errorMessage = '';
        this.submitError = '';
    }

    isFieldInvalid(fieldName: string): boolean {
        const field = this.resetForm.get(fieldName);
        return !!(field && field.invalid && (field.dirty || field.touched));
    }

    getFieldError(fieldName: string): string {
        const field = this.resetForm.get(fieldName);
        if (field && field.errors) {
            if (field.errors['required']) {
                return `${this.getFieldDisplayName(fieldName)} is required`;
            }
            if (field.errors['minlength']) {
                return `${this.getFieldDisplayName(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters`;
            }
            if (field.errors['noCapitalLetter']) {
                return `${this.getFieldDisplayName(fieldName)} must contain at least one capital letter`;
            }
            if (field.errors['passwordMismatch']) {
                return 'Passwords do not match';
            }
        }
        return '';
    }

    private getFieldDisplayName(fieldName: string): string {
        const displayNames: { [key: string]: string } = {
            newPassword: 'New Password',
            confirmPassword: 'Confirm Password'
        };
        return displayNames[fieldName] || fieldName;
    }

    togglePasswordVisibility(): void {
        this.showPassword = !this.showPassword;
    }

    toggleConfirmPasswordVisibility(): void {
        this.showConfirmPassword = !this.showConfirmPassword;
    }

    get hasMinLength(): boolean {
        const password = this.resetForm.get('newPassword');
        return !!(password && password.value && password.value.length >= 6);
    }

    get hasCapitalLetter(): boolean {
        const password = this.resetForm.get('newPassword');
        return !!(password && password.value && /[A-Z]/.test(password.value));
    }

    goToLogin(): void {
        this.router.navigate(['/login']);
    }

    requestNewReset(): void {
        this.router.navigate(['/forgot-password']);
    }
}
