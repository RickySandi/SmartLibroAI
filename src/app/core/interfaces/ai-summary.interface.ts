export interface SourceAttribution {
    type: 'book_description' | 'publisher_info' | 'author_bio' | 'category_data' | 'review_excerpt' | 'metadata' | 'ai_knowledge' | 'fallback_template';
    content: string;
    reliability: number; // 0-100
    relevance: number; // 0-100
    length: number;
    source: string;
    weight: number; // How much this source contributed to the final summary
}

export interface DetailedConfidenceFactors {
    dataQuality: {
        score: number; // 0-100
        factors: {
            descriptionLength: number;
            metadataCompleteness: number;
            publisherReliability: number;
            authorCredibility: number;
        };
    };
    sourceReliability: {
        score: number; // 0-100
        factors: {
            primarySourcesCount: number;
            averageSourceReliability: number;
            sourceConsistency: number;
            verifiableInformation: number;
        };
    };
    contentCoverage: {
        score: number; // 0-100
        factors: {
            topicCoverage: number;
            thematicDepth: number;
            conceptualClarity: number;
            structuralCompleteness: number;
        };
    };
    aiProcessing: {
        score: number; // 0-100
        factors: {
            languageConsistency: number;
            translationQuality: number;
            summarizationAccuracy: number;
            responseCoherence: number;
        };
    };
    crossValidation: {
        score: number; // 0-100
        factors: {
            multiSourceVerification: number;
            factualConsistency: number;
            contextualRelevance: number;
            logicalCoherence: number;
        };
    };
}

export interface AIBookSummary {
    shortSummary: string;  // 300 characters
    detailedSummary: string;  // 1000 characters
    confidenceScore: number;  // 0-100
    reasoningFactors: string[];
    sourcesUsed: string[];
    sourceAttribution: SourceAttribution[];
    detailedConfidenceFactors: DetailedConfidenceFactors;
    language: string;
    generatedAt: Date;
    processingMethod: 'openai_api' | 'fallback_template';
    translationApplied: boolean;
}

export interface SummaryRequest {
    title: string;
    authors: string[];
    isbn: string;
    description: string;
    categories: string[];
    publisher: string;
    publishedDate: string;
    pageCount: number;
    language: string;
    targetLanguage: string;
}
