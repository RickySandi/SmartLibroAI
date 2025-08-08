export interface RecentSummary {
    id: string;
    isbn: string;
    title: string;
    authors: string[];
    publishedDate?: string;
    imageLinks?: {
        thumbnail?: string;
        smallThumbnail?: string;
    };
    language: string;
    generatedAt: Date;
    isSaved: boolean;
    summary?: {
        overview: string;
        keyPoints: string[];
        electoralRelevance: string;
    };
}
