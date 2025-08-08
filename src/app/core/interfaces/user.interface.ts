export interface User {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    emailVerified: boolean;
    createdAt: any;
    updatedAt: any;
    preferences?: {
        language: string;
        theme: string;
    };
    libraryCount?: number;
}
