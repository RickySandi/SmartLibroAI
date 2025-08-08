import { Injectable } from '@angular/core';
import { RecentSummary } from '../interfaces';

@Injectable({
    providedIn: 'root'
})
export class RecentActivityService {
    private readonly STORAGE_KEY = 'smartlibro_recent_summaries';
    private readonly MAX_ITEMS = 5;

    constructor() { }

    addRecentSummary(summary: Omit<RecentSummary, 'id' | 'generatedAt'>): void {
        const recentSummaries = this.getRecentSummaries();

        const newSummary: RecentSummary = {
            ...summary,
            id: this.generateId(),
            generatedAt: new Date()
        };

        const filteredSummaries = recentSummaries.filter(s => s.isbn !== summary.isbn);
        const updatedSummaries = [newSummary, ...filteredSummaries];
        const trimmedSummaries = updatedSummaries.slice(0, this.MAX_ITEMS);

        this.saveToStorage(trimmedSummaries);
    }

    getRecentSummaries(): RecentSummary[] {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) return [];

            const summaries = JSON.parse(stored) as RecentSummary[];

            return summaries.map(summary => ({
                ...summary,
                generatedAt: new Date(summary.generatedAt)
            }));
        } catch (error) {
            console.error('Error loading recent summaries:', error);
            return [];
        }
    }

    markAsSaved(isbn: string): void {
        const summaries = this.getRecentSummaries();
        const updatedSummaries = summaries.map(summary =>
            summary.isbn === isbn ? { ...summary, isSaved: true } : summary
        );
        this.saveToStorage(updatedSummaries);
    }

    removeSummary(id: string): void {
        const summaries = this.getRecentSummaries();
        const filteredSummaries = summaries.filter(summary => summary.id !== id);
        this.saveToStorage(filteredSummaries);
    }

    clearAll(): void {
        localStorage.removeItem(this.STORAGE_KEY);
    }

    getSummaryByIsbn(isbn: string): RecentSummary | null {
        const summaries = this.getRecentSummaries();
        return summaries.find(summary => summary.isbn === isbn) || null;
    }

    private saveToStorage(summaries: RecentSummary[]): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(summaries));
        } catch (error) {
            console.error('Error saving recent summaries:', error);
        }
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}
