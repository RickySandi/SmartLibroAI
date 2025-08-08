import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { RecentActivityService } from '../../core/services/recent-activity.service';
import { RecentSummary } from '../../core/interfaces';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
    recentSummaries: RecentSummary[] = [];
    showClearConfirmation = false;

    constructor(
        public authService: AuthService,
        private recentActivityService: RecentActivityService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.loadRecentActivity();
    }

    private loadRecentActivity(): void {
        this.recentSummaries = this.recentActivityService.getRecentSummaries();
    }

    getTimeAgo(date: Date): string {
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;

        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}d ago`;

        return date.toLocaleDateString();
    }

    viewSummary(summary: RecentSummary): void {
        this.router.navigate(['/book-summary'], {
            queryParams: { isbn: summary.isbn }
        });
    }

    removeSummary(summaryId: string): void {
        this.recentActivityService.removeSummary(summaryId);
        this.loadRecentActivity();
    }

    clearAllActivity(): void {
        this.toggleClearConfirmation();
    }

    toggleClearConfirmation(): void {
        this.showClearConfirmation = !this.showClearConfirmation;
    }

    confirmClearAll(): void {
        this.recentActivityService.clearAll();
        this.loadRecentActivity();
        this.showClearConfirmation = false;
    }

    async logout(): Promise<void> {
        try {
            await this.authService.signOut();
            this.router.navigate(['/login']);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
}