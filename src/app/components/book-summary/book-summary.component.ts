import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { BookService } from '../../core/services/book.service';
import { RecentActivityService } from '../../core/services/recent-activity.service';
import { ConfidenceMetricsComponent } from '../confidence-metrics/confidence-metrics.component';
import { AuthUser } from '../../core/interfaces';

@Component({
    selector: 'app-book-summary',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule, ConfidenceMetricsComponent],
    templateUrl: './book-summary.component.html',
    styleUrls: ['./book-summary.component.scss']
})
export class BookSummaryComponent implements OnInit, OnDestroy {

    isbnForm!: FormGroup;
    isLoading = false;
    errorMessage = '';
    successMessage = '';
    limitMessage: string = '';
    bookData: any = null;
    summaries: any = null;
    confidenceMetrics: any = null;
    aiSummary: any = null;

    private destroy$ = new Subject<void>();

    languageMap: Record<string, string> = {
        'en': 'English',
        'es': 'Español',
        'fr': 'Français',
        'de': 'Deutsch',
        'it': 'Italiano',
        'pt': 'Português'
    };

    isDemoMode = false;

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private bookService: BookService,
        private recentActivityService: RecentActivityService,
        private route: ActivatedRoute
    ) { }

    ngOnInit(): void {
        this.initializeForm();
        this.checkQueryParams();
    }

    private checkQueryParams(): void {
        this.route.queryParams.subscribe(params => {
            const isbn = params['isbn'];
            if (isbn) {
                this.isbnForm.patchValue({ isbn });
            }
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private initializeForm(): void {
        const browserLang = navigator.language.split('-')[0];
        const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt'];
        const defaultLang = supportedLanguages.includes(browserLang) ? browserLang : 'en';

        this.isbnForm = this.fb.group({
            isbn: ['', [Validators.required, this.isbnValidator.bind(this)]],
            language: [defaultLang, Validators.required]
        });

        this.isbnForm.valueChanges.subscribe(() => {
            if (this.errorMessage) {
                this.errorMessage = '';
            }
        });
    }

    static validateISBN10(isbn: string): boolean {
        if (!/^[\dX]{10}$/.test(isbn)) return false;
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += (10 - i) * parseInt(isbn[i]);
        }
        let check = isbn[9] === 'X' ? 10 : parseInt(isbn[9]);
        sum += check;
        return sum % 11 === 0;
    }

    isbnValidator(control: any): { [key: string]: boolean } | null {
        const value = control.value?.replace(/[-\s]/g, '');
        if (!value) return null;
        if (value.length === 10 && !BookSummaryComponent.validateISBN10(value)) {
            return { invalidIsbn: true };
        }
        if (value.length === 13 && !BookSummaryComponent.validateISBN13(value)) {
            return { invalidIsbn: true };
        }
        if (value.length !== 10 && value.length !== 13) {
            return { invalidIsbn: true };
        }
        return null;
    }

    static validateISBN13(isbn: string): boolean {
        if (!/^\d{13}$/.test(isbn)) return false;

        let sum = 0;
        for (let i = 0; i < 12; i++) {
            sum += parseInt(isbn[i]) * (i % 2 === 0 ? 1 : 3);
        }

        const checkDigit = parseInt(isbn[12]);
        const calculatedCheck = (10 - (sum % 10)) % 10;

        return checkDigit === calculatedCheck;
    }

    formatISBN(isbn: string): string {
        const cleanISBN = isbn.replace(/[-\s]/g, '');

        if (cleanISBN.length === 10) {
            return `${cleanISBN.slice(0, 1)}-${cleanISBN.slice(1, 5)}-${cleanISBN.slice(5, 9)}-${cleanISBN.slice(9)}`;
        } else if (cleanISBN.length === 13) {
            return `${cleanISBN.slice(0, 3)}-${cleanISBN.slice(3, 4)}-${cleanISBN.slice(4, 6)}-${cleanISBN.slice(6, 12)}-${cleanISBN.slice(12)}`;
        }

        return isbn;
    }

    async onSubmit(): Promise<void> {
        if (this.isbnForm.valid && !this.isLoading) {
            this.isLoading = true;
            this.errorMessage = '';
            this.successMessage = '';
            this.bookData = null;
            this.summaries = null;
            this.confidenceMetrics = null;

            const { isbn, language } = this.isbnForm.value;
            const cleanISBN = isbn.replace(/[-\s]/g, '');

            try {
                this.bookData = await this.bookService.getBookByISBN(cleanISBN);
                this.successMessage = 'Generating AI-powered summary... (This may take 10-30 seconds due to rate limiting)';
                const summaryResult = await this.bookService.generateSummaries(this.bookData, language);
                this.summaries = summaryResult.summary;
                this.aiSummary = summaryResult.aiSummary;

                this.confidenceMetrics = await this.bookService.calculateConfidenceMetrics(
                    this.bookData,
                    this.summaries,
                    this.aiSummary
                );

                if (this.bookData.language !== language) {
                    console.log(`📝 Translation completed: ${this.bookData.language} → ${language}`);
                    this.successMessage = `Book summary generated successfully! (Translated from ${this.bookData.language} to ${this.getLanguageName(language)})`;
                } else {
                    this.successMessage = 'Book summary generated successfully!';
                }

                if (!this.validateSummaryLanguage(this.summaries, language)) {
                    console.warn('Warning: Generated summary may contain mixed languages');
                    this.errorMessage = `Warning: The generated summary appears to mix languages. Expected: ${this.getLanguageName(language)}`;
                }

                this.successMessage = 'Book summary generated successfully!';

                this.addToRecentActivity(cleanISBN, language);

            } catch (error) {
                console.error('Error generating book summary:', error);

                const errorMsg = error instanceof Error ? error.message : String(error);
                if (
                    errorMsg.includes('rate limit') ||
                    errorMsg.includes('429') ||
                    errorMsg.includes('Too many requests')
                ) {
                    this.limitMessage = '⏱️ You have reached the maximum number of free summaries allowed. Please wait and try again later.';
                    this.errorMessage = '';
                    this.enableDemoMode();

                    const demoSummary = this.generateDemoSummary(language);
                    this.summaries = demoSummary;
                    this.successMessage = '🎭 Demo summary generated (Rate limit protection active)';
                    return;
                } else if (
                    errorMsg.includes('Service temporarily unavailable: free tier usage limit reached') ||
                    errorMsg.includes('503')
                ) {
                    this.limitMessage = '🚫 The free tier usage limit for SmartLibroAI has been reached. Please try again next month or deploy your own instance.';
                    this.errorMessage = '';
                    this.summaries = null;
                    this.successMessage = '';
                    return;
                } else {
                    this.errorMessage = errorMsg;
                    this.limitMessage = '';
                }

                this.isbnForm.markAllAsTouched();
            } finally {
                this.isLoading = false;
            }
        } else {
            this.isbnForm.markAllAsTouched();
        }
    }

    getFieldError(fieldName: string): string {
        const field = this.isbnForm.get(fieldName);
        if (field?.errors && field?.touched) {
            if (field.errors['required']) {
                return fieldName === 'isbn' ? 'ISBN is required.' : 'Language is required.';
            }
            if (field.errors['invalidIsbn']) {
                return 'Please enter a valid ISBN-10 or ISBN-13.';
            }
        }
        return '';
    }

    isFieldInvalid(fieldName: string): boolean {
        const field = this.isbnForm.get(fieldName);
        return !!(field?.errors && field?.touched);
    }

    getConfidenceColor(score: number): string {
        if (score >= 80) return 'text-green-600 bg-green-100';
        if (score >= 60) return 'text-yellow-600 bg-yellow-100';
        if (score >= 40) return 'text-orange-600 bg-orange-100';
        return 'text-red-600 bg-red-100';
    }

    getConfidenceText(score: number): string {
        if (score >= 80) return 'High Confidence';
        if (score >= 60) return 'Medium Confidence';
        if (score >= 40) return 'Low Confidence';
        return 'Very Low Confidence';
    }

    getLanguageName(code: string): string {
        return this.languageMap[code] || code;
    }

    generateDemoSummary(language: string): any {
        const demoSummaries: Record<string, any> = {
            'es': {
                short: 'Yuval Noah Harari presenta "Nexus", una obra reflexiva que explora teorías fundamentales sobre el desarrollo humano y tecnológico.',
                detailed: '"Nexus" de Yuval Noah Harari es una obra completa que analiza en profundidad los conceptos fundamentales del desarrollo tecnológico y social. El autor presenta metodologías innovadoras y casos de estudio relevantes que demuestran la aplicación práctica de estas teorías en contextos contemporáneos. La obra ofrece perspectivas únicas sobre el futuro de la humanidad y la tecnología.'
            },
            'en': {
                short: 'Yuval Noah Harari presents "Nexus", a thought-provoking work that explores fundamental theories about human and technological development.',
                detailed: '"Nexus" by Yuval Noah Harari is a comprehensive work that analyzes fundamental concepts of technological and social development. The author presents innovative methodologies and relevant case studies that demonstrate the practical application of these theories in contemporary contexts. The work offers unique perspectives on the future of humanity and technology.'
            },
            'fr': {
                short: 'Yuval Noah Harari présente "Nexus", une œuvre stimulante qui explore les théories fondamentales du développement humain et technologique.',
                detailed: '"Nexus" de Yuval Noah Harari est une œuvre complète qui analyse les concepts fondamentaux du développement technologique et social. L\'auteur présente des méthodologies innovantes et des études de cas pertinentes qui démontrent l\'application pratique de ces théories dans des contextes contemporains.'
            }
        };

        return demoSummaries[language] || demoSummaries['en'];
    }

    enableDemoMode(): void {
        this.isDemoMode = true;
        console.log('🎭 Demo mode enabled due to rate limiting');
    }

    private addToRecentActivity(isbn: string, language: string): void {
        if (!this.bookData || !this.summaries) {
            return;
        }

        try {
            const recentSummary = {
                isbn: isbn,
                title: this.bookData.title || 'Unknown Title',
                authors: this.bookData.authors || [],
                publishedDate: this.bookData.publishedDate,
                imageLinks: this.bookData.imageLinks,
                language: language,
                isSaved: false,
                summary: {
                    overview: this.summaries.overview || '',
                    keyPoints: this.summaries.keyPoints || [],
                    electoralRelevance: this.summaries.electoralRelevance || ''
                }
            };

            this.recentActivityService.addRecentSummary(recentSummary);
            console.log('Added to recent activity:', recentSummary.title);
        } catch (error) {
            console.error('Error adding to recent activity:', error);
        }
    }

    private validateSummaryLanguage(summaries: any, expectedLanguage: string): boolean {
        if (!summaries || expectedLanguage === 'en') {
            return true;
        }

        const shortText = summaries.short?.toLowerCase() || '';
        const detailedText = summaries.detailed?.toLowerCase() || '';
        const fullText = `${shortText} ${detailedText}`;

        const languagePatterns: Record<string, string[]> = {
            'en': ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were'],
            'es': ['el', 'la', 'los', 'las', 'de', 'del', 'en', 'con', 'por', 'para', 'que', 'es', 'son', 'una', 'uno', 'esta', 'este', 'libro', 'obra'],
            'fr': ['le', 'la', 'les', 'de', 'du', 'des', 'en', 'avec', 'pour', 'que', 'est', 'sont', 'une', 'un', 'cette', 'ce', 'livre', 'oeuvre'],
            'de': ['der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'und', 'mit', 'für', 'ist', 'sind', 'diese', 'dieser', 'buch', 'werk'],
            'it': ['il', 'la', 'lo', 'gli', 'le', 'di', 'del', 'in', 'con', 'per', 'che', 'è', 'sono', 'una', 'un', 'questo', 'questa', 'libro', 'opera'],
            'pt': ['o', 'a', 'os', 'as', 'de', 'do', 'da', 'em', 'com', 'por', 'para', 'que', 'é', 'são', 'uma', 'um', 'este', 'esta', 'livro', 'obra']
        };

        const expectedWords = languagePatterns[expectedLanguage] || [];
        const expectedWordCount = expectedWords.filter(word =>
            fullText.includes(` ${word} `) || fullText.startsWith(`${word} `) || fullText.endsWith(` ${word}`)
        ).length;

        let wrongLanguageCount = 0;
        if (expectedLanguage !== 'en') {
            const englishWords = languagePatterns['en'];
            wrongLanguageCount = englishWords.filter(word =>
                fullText.includes(` ${word} `) || fullText.startsWith(`${word} `) || fullText.endsWith(` ${word}`)
            ).length;
        }

        const isValid = expectedWordCount >= 3 && wrongLanguageCount <= 1;

        console.log(`Language validation for ${expectedLanguage}:`, {
            expectedWordCount,
            wrongLanguageCount,
            isValid,
            textSample: fullText.substring(0, 100)
        });

        return isValid;
    }

    async saveToLibrary(): Promise<void> {
        if (this.bookData && this.summaries && this.confidenceMetrics) {
            try {
                const currentUser = await new Promise<AuthUser | null>((resolve) => {
                    this.authService.user$.pipe(takeUntil(this.destroy$)).subscribe(user => {
                        resolve(user);
                    });
                });

                if (!currentUser) {
                    this.errorMessage = 'You must be logged in to save books to your library.';
                    return;
                }

                const libraryItemId = await this.bookService.saveToUserLibrary({
                    bookData: this.bookData,
                    summaries: this.summaries,
                    confidenceMetrics: this.confidenceMetrics,
                    aiSummary: this.aiSummary,
                    createdAt: new Date(),
                    userId: currentUser.uid
                });

                this.successMessage = 'Book saved to your library successfully!';
                console.log('Book saved with ID:', libraryItemId);

                const cleanISBN = this.bookData.isbn || this.isbnForm.get('isbn')?.value?.replace(/[-\s]/g, '');
                if (cleanISBN) {
                    this.recentActivityService.markAsSaved(cleanISBN);
                }

                setTimeout(() => {
                    this.successMessage = '';
                }, 3000);

            } catch (error) {
                console.error('Save to library error:', error);
                this.errorMessage = error instanceof Error ? error.message : 'Failed to save book to library.';

                setTimeout(() => {
                    this.errorMessage = '';
                }, 5000);
            }
        } else {
            this.errorMessage = 'No book data available to save.';
        }
    }
}
