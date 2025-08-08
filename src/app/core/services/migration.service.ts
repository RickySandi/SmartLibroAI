import { Injectable } from '@angular/core';
import { BookService } from './book.service';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class MigrationService {

    constructor(
        private bookService: BookService,
        private authService: AuthService
    ) { }

    async migrateLibraryFromLocalStorage(): Promise<{ success: number; errors: number }> {
        try {
            const currentUser = await new Promise<any>((resolve) => {
                this.authService.user$.subscribe(user => {
                    if (user) resolve(user);
                });
            });

            if (!currentUser) {
                throw new Error('User must be logged in to migrate data');
            }

            const userId = currentUser.uid;
            const libraryKey = `library_${userId}`;
            const localLibrary = JSON.parse(localStorage.getItem(libraryKey) || '[]');

            if (localLibrary.length === 0) {
                return { success: 0, errors: 0 };
            }

            console.log(`Found ${localLibrary.length} items in localStorage to migrate`);

            let successCount = 0;
            let errorCount = 0;

            for (const item of localLibrary) {
                try {
                    const libraryItem = {
                        bookData: item.bookData,
                        summaries: {
                            ...item.summaries,
                            generatedAt: new Date(item.summaries.generatedAt)
                        },
                        confidenceMetrics: item.confidenceMetrics,
                        aiSummary: item.aiSummary,
                        createdAt: new Date(item.createdAt),
                        userId: userId
                    };

                    await this.bookService.saveToUserLibrary(libraryItem);
                    successCount++;

                } catch (error) {
                    console.error(`Failed to migrate item: ${item.bookData?.title}`, error);
                    errorCount++;
                }
            }

            if (errorCount === 0) {
                localStorage.removeItem(libraryKey);
            }

            return { success: successCount, errors: errorCount };

        } catch (error) {
            console.error('Migration failed:', error);
            throw error;
        }
    }

    hasLocalLibraryData(): boolean {
        const keys = Object.keys(localStorage);
        return keys.some(key => key.startsWith('library_'));
    }

    getLocalLibraryCount(): number {
        const currentUser = this.authService.getCurrentUser();
        if (!currentUser) return 0;

        const libraryKey = `library_${currentUser.uid}`;
        const localLibrary = JSON.parse(localStorage.getItem(libraryKey) || '[]');
        return localLibrary.length;
    }
}
