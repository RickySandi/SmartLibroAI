import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { BookService } from '../../core/services/book.service';
import { AuthUser, UserLibraryItem } from '../../core/interfaces';

@Component({
    selector: 'app-library',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './library.component.html',
    styleUrls: ['./library.component.scss']
})
export class LibraryComponent implements OnInit, OnDestroy {
    libraryItems: UserLibraryItem[] = [];
    filteredItems: UserLibraryItem[] = [];
    isLoading = true;
    errorMessage = '';
    searchTerm = '';
    sortBy = 'newest';
    expandedItems = new Set<string>();

    private destroy$ = new Subject<void>();

    constructor(
        private authService: AuthService,
        private bookService: BookService
    ) { }

    ngOnInit(): void {
        this.checkAuthState();
        this.loadLibrary();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private checkAuthState(): void {
        this.authService.user$
            .pipe(takeUntil(this.destroy$))
            .subscribe((user: AuthUser | null) => {
                if (!user) {
                    this.errorMessage = 'You must be logged in to access your library';
                    this.isLoading = false;
                }
            });
    }

    async loadLibrary(): Promise<void> {
        try {
            this.isLoading = true;
            this.libraryItems = await this.bookService.getUserLibrary();
            this.filteredItems = [...this.libraryItems];
            this.sortLibrary();
        } catch (error) {
            this.errorMessage = 'Failed to load library';
            console.error('Error loading library:', error);
        } finally {
            this.isLoading = false;
        }
    }

    onSearch(event: any): void {
        this.searchTerm = event.target.value.toLowerCase();
        this.filterAndSort();
    }

    onSortChange(event: any): void {
        this.sortBy = event.target.value;
        this.filterAndSort();
    }

    private filterAndSort(): void {
        if (this.searchTerm) {
            this.filteredItems = this.libraryItems.filter(item =>
                item.bookData.title.toLowerCase().includes(this.searchTerm) ||
                item.bookData.authors.some(author =>
                    author.toLowerCase().includes(this.searchTerm)
                ) ||
                item.bookData.categories.some(category =>
                    category.toLowerCase().includes(this.searchTerm)
                )
            );
        } else {
            this.filteredItems = [...this.libraryItems];
        }

        this.sortLibrary();
    }

    private sortLibrary(): void {
        switch (this.sortBy) {
            case 'newest':
                this.filteredItems.sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                break;
            case 'oldest':
                this.filteredItems.sort((a, b) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
                break;
            case 'title':
                this.filteredItems.sort((a, b) =>
                    a.bookData.title.localeCompare(b.bookData.title)
                );
                break;
            case 'author':
                this.filteredItems.sort((a, b) =>
                    a.bookData.authors[0].localeCompare(b.bookData.authors[0])
                );
                break;
            case 'confidence':
                this.filteredItems.sort((a, b) =>
                    b.confidenceMetrics.overallScore - a.confidenceMetrics.overallScore
                );
                break;
        }
    }

    getConfidenceColor(score: number): string {
        if (score >= 80) return 'text-green-600 bg-green-100';
        if (score >= 60) return 'text-yellow-600 bg-yellow-100';
        if (score >= 40) return 'text-orange-600 bg-orange-100';
        return 'text-red-600 bg-red-100';
    }

    getConfidenceText(score: number): string {
        if (score >= 80) return 'High';
        if (score >= 60) return 'Medium';
        if (score >= 40) return 'Low';
        return 'Very Low';
    }

    toggleExpanded(itemId: string): void {
        if (this.expandedItems.has(itemId)) {
            this.expandedItems.delete(itemId);
        } else {
            this.expandedItems.add(itemId);
        }
    }

    isExpanded(itemId: string): boolean {
        return this.expandedItems.has(itemId);
    }

    async deleteItem(itemId: string): Promise<void> {
        if (confirm('Are you sure you want to delete this book summary?')) {
            try {
                await this.bookService.deleteFromUserLibrary(itemId);
                await this.loadLibrary();
            } catch (error) {
                this.errorMessage = 'Failed to delete item';
                console.error('Error deleting item:', error);
            }
        }
    }

    async exportSummary(item: UserLibraryItem, format: 'txt' | 'json' = 'txt'): Promise<void> {
        try {
            let content = '';
            let filename = '';
            let mimeType = '';

            if (format === 'txt') {
                content = this.generateTextExport(item);
                filename = `${item.bookData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_summary.txt`;
                mimeType = 'text/plain';
            } else {
                content = JSON.stringify(item, null, 2);
                filename = `${item.bookData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_summary.json`;
                mimeType = 'application/json';
            }

            const blob = new Blob([content], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            this.errorMessage = 'Failed to export summary';
            console.error('Error exporting summary:', error);
        }
    }

    private generateTextExport(item: UserLibraryItem): string {
        return `
SMARTLIBRO AI - BOOK SUMMARY
============================

Book Information:
- Title: ${item.bookData.title}
- Author(s): ${item.bookData.authors.join(', ')}
- Publisher: ${item.bookData.publisher}
- Published: ${item.bookData.publishedDate}
- Pages: ${item.bookData.pageCount || 'Unknown'}
- Categories: ${item.bookData.categories.join(', ')}
- ISBN: ${item.bookData.isbn}
- Rating: ${item.bookData.averageRating || 'N/A'}/5 (${item.bookData.ratingsCount || 0} reviews)

AI Confidence Metrics:
- Overall Score: ${item.confidenceMetrics.overallScore}%
- Source Reliability: ${item.confidenceMetrics.sourceReliability}%
- Content Coverage: ${item.confidenceMetrics.contentCoverage}%
- Cross-Reference Validation: ${item.confidenceMetrics.crossReferenceValidation}%

Quick Summary (${item.summaries.short.length}/300 characters):
${item.summaries.short}

Detailed Summary (${item.summaries.detailed.length}/1000 characters):
${item.summaries.detailed}

Generated: ${item.summaries.generatedAt}
Language: ${item.summaries.language.toUpperCase()}
Saved: ${item.createdAt}

---
Generated by SmartLibro AI - Intelligent Book Summaries for Electoral Services
    `.trim();
    }
}
