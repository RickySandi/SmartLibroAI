import { AIBookSummary } from './ai-summary.interface';

export interface BookMetadata {
  isbn: string;
  title: string;
  authors: string[];
  publisher: string;
  publishedDate: string;
  description: string;
  pageCount: number;
  categories: string[];
  averageRating: number;
  ratingsCount: number;
  imageLinks: {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
  };
  language: string;
}

export interface BookSummary {
  short: string; // 300 characters
  detailed: string; // 1000 characters
  language: string;
  generatedAt: Date;
}

export interface ConfidenceMetrics {
  overallScore: number; // 0-100
  sourceReliability: number;
  contentCoverage: number;
  crossReferenceValidation: number;
  factors: {
    sourcesUsed: number;
    averageSourceRating: number;
    descriptionLength: number;
    reviewsCount: number;
    dataQualityScore: number;
    aiProcessingScore: number;
    translationPenalty: number;
  };
  detailedBreakdown?: {
    dataQuality: number;
    sourceReliability: number;
    contentCoverage: number;
    aiProcessing: number;
    crossValidation: number;
  };
  sourceAttribution?: any[]; // Will be populated from AI response
}

export interface SummaryResult {
  summary: BookSummary;
  aiSummary?: AIBookSummary;
}

export interface UserLibraryItem {
  id?: string;
  bookData: BookMetadata;
  summaries: BookSummary;
  confidenceMetrics: ConfidenceMetrics;
  aiSummary?: AIBookSummary; // Include AI summary for detailed analysis
  createdAt: Date;
  updatedAt?: Date;
  userId: string; // Make userId required for Firestore
}
