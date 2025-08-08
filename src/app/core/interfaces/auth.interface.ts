export interface AuthUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    emailVerified: boolean;
    providerId?: string; // Add provider information
    providerData?: any[]; // Add provider data
}
