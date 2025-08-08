import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,

} from 'firebase/firestore';
import { OpenAIService } from './openai.service';
import { CloudFunctionService } from './cloud-function.service';
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { environment } from '../../../environments/environment';
import {
  AIBookSummary,
  SummaryRequest,
  BookMetadata,
  BookSummary,
  ConfidenceMetrics,
  SummaryResult,
  UserLibraryItem
} from '../interfaces';
import {
  FORBIDDEN_ENGLISH_WORDS,
  LANGUAGE_REPLACEMENTS,
  LANGUAGE_PHRASE_PATTERNS,
  LANGUAGE_WORD_PATTERNS
} from '../utils/constants';

@Injectable({
  providedIn: 'root'
})
export class BookService {
  private readonly GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';
  private firestore: Firestore;

  constructor(
    private http: HttpClient,
    private openaiService: OpenAIService,
    private cloudFunctionService: CloudFunctionService,
    private firebaseService: FirebaseService,
    private authService: AuthService,
    private userService: UserService
  ) {
    this.firestore = this.firebaseService.getFirestore();
  }

  async getBookByISBN(isbn: string): Promise<BookMetadata> {
    try {

      const response = await this.http.get(`${this.GOOGLE_BOOKS_API}?q=isbn:${isbn}`).toPromise() as any;

      if (!response.items || response.items.length === 0) {
        throw new Error('Book not found. Please check the ISBN and try again.');
      }

      const book = response.items[0];
      const volumeInfo = book.volumeInfo;

      const bookData: BookMetadata = {
        isbn: isbn,
        title: volumeInfo.title || 'Unknown Title',
        authors: volumeInfo.authors || ['Unknown Author'],
        publisher: volumeInfo.publisher || 'Unknown Publisher',
        publishedDate: volumeInfo.publishedDate || 'Unknown Date',
        description: volumeInfo.description || 'No description available.',
        pageCount: volumeInfo.pageCount || 0,
        categories: volumeInfo.categories || ['Uncategorized'],
        averageRating: volumeInfo.averageRating || 0,
        ratingsCount: volumeInfo.ratingsCount || 0,
        imageLinks: {
          thumbnail: volumeInfo.imageLinks?.thumbnail || '',
          small: volumeInfo.imageLinks?.small || '',
          medium: volumeInfo.imageLinks?.medium || '',
          large: volumeInfo.imageLinks?.large || ''
        },
        language: volumeInfo.language || 'en'
      };

      return bookData;

    } catch (error) {
      console.error('Error fetching book data:', error);
      throw new Error('Failed to fetch book information. Please check your internet connection and try again.');
    }
  }

  async generateSummaries(bookData: BookMetadata, language: string = 'en'): Promise<SummaryResult> {
    try {
      // Validate required fields before calling cloud function
      if (!bookData.title || !bookData.isbn) {
        console.error('Missing title or ISBN in bookData:', bookData);
        throw new Error('Book data is missing title or ISBN. Cannot generate summary.');
      }

      const summaryRequest: SummaryRequest = {
        title: bookData.title,
        authors: bookData.authors,
        isbn: bookData.isbn,
        description: bookData.description,
        categories: bookData.categories,
        publisher: bookData.publisher,
        publishedDate: bookData.publishedDate,
        pageCount: bookData.pageCount,
        language: bookData.language,
        targetLanguage: language
      };

      console.log('SummaryRequest payload:', summaryRequest);

      let aiSummary: AIBookSummary;

      if (environment.useCloudFunctions && this.cloudFunctionService.isCloudFunctionEnabled()) {
        aiSummary = await this.cloudFunctionService.generateBookSummary(summaryRequest);
      } else {
        aiSummary = await this.openaiService.generateBookSummary(summaryRequest);
      }

      aiSummary = this.validateAndCleanSummaryLanguage(aiSummary, language);

      if (aiSummary.language !== language) {
        console.warn(`Language mismatch! Expected: ${language}, Got: ${aiSummary.language}`);
      }

      const bookSummary: BookSummary = {
        short: aiSummary.shortSummary,
        detailed: aiSummary.detailedSummary,
        language: language,
        generatedAt: aiSummary.generatedAt
      };

      return {
        summary: bookSummary,
        aiSummary: aiSummary
      };

    } catch (error) {
      console.error('Error generating AI summaries:', error);

      const isQuotaError = error instanceof Error && (
        error.message.includes('insufficient_quota') ||
        error.message.includes('quota') ||
        error.message.includes('billing')
      );

      if (isQuotaError) {
        console.warn('⚠️ OpenAI quota exceeded - using enhanced demo mode');

        const demoSummary = this.generateEnhancedDemoSummary(bookData, language);

        const { sourceAttribution } = this.calculateDetailedConfidence(
          bookData,
          undefined,
          true,
          bookData.language !== language
        );

        return {
          summary: demoSummary,
          aiSummary: {
            shortSummary: demoSummary.short,
            detailedSummary: demoSummary.detailed,
            confidenceScore: 75,
            reasoningFactors: ['Demo mode due to API quota limits'],
            sourcesUsed: ['Book metadata', 'Demo generation'],
            sourceAttribution: sourceAttribution,
            detailedConfidenceFactors: {
              dataQuality: { score: 70, factors: { descriptionLength: 0, metadataCompleteness: 80, publisherReliability: 70, authorCredibility: 60 } },
              sourceReliability: { score: 75, factors: { primarySourcesCount: 2, averageSourceReliability: 75, sourceConsistency: 80, verifiableInformation: 70 } },
              contentCoverage: { score: 65, factors: { topicCoverage: 60, thematicDepth: 70, conceptualClarity: 65, structuralCompleteness: 65 } },
              aiProcessing: { score: 85, factors: { languageConsistency: 90, translationQuality: 80, summarizationAccuracy: 85, responseCoherence: 85 } },
              crossValidation: { score: 70, factors: { multiSourceVerification: 60, factualConsistency: 80, contextualRelevance: 70, logicalCoherence: 70 } }
            },
            language: language,
            generatedAt: new Date(),
            processingMethod: 'fallback_template' as const,
            translationApplied: bookData.language !== language
          }
        };
      }

      const fallbackSummary = this.generateFallbackSummary(bookData, language);

      return {
        summary: fallbackSummary,
        aiSummary: undefined
      };
    }
  }

  private generateEnhancedDemoSummary(bookData: any, language: string): any {
    const title = bookData.title || 'Unknown Title';
    const author = bookData.authors?.[0] || 'Unknown Author';
    const categories = bookData.categories?.join(', ') || 'General';

    const templates: Record<string, { short: string; detailed: string }> = {
      'es': {
        short: `"${title}" de ${author} es una obra ${categories.toLowerCase().includes('fiction') ? 'narrativa' : 'académica'} que explora temas fundamentales con perspectivas innovadoras y análisis profundo.`,
        detailed: `"${title}" de ${author} representa una contribución significativa al campo de ${categories}. La obra presenta un análisis exhaustivo de conceptos fundamentales, ofreciendo perspectivas únicas y metodologías innovadoras. El autor desarrolla argumentos sólidos respaldados por investigación rigurosa, proporcionando a los lectores herramientas valiosas para comprender temas complejos. Esta publicación se destaca por su enfoque integral y su capacidad para abordar cuestiones contemporáneas con claridad y profundidad analítica.`
      },
      'en': {
        short: `"${title}" by ${author} is a ${categories.toLowerCase().includes('fiction') ? 'narrative' : 'scholarly'} work that explores fundamental themes with innovative perspectives and deep analysis.`,
        detailed: `"${title}" by ${author} represents a significant contribution to the field of ${categories}. The work presents an exhaustive analysis of fundamental concepts, offering unique perspectives and innovative methodologies. The author develops solid arguments backed by rigorous research, providing readers with valuable tools to understand complex topics. This publication stands out for its comprehensive approach and ability to address contemporary issues with clarity and analytical depth.`
      },
      'fr': {
        short: `"${title}" de ${author} est une œuvre ${categories.toLowerCase().includes('fiction') ? 'narrative' : 'académique'} qui explore des thèmes fondamentaux avec des perspectives innovantes et une analyse approfondie.`,
        detailed: `"${title}" de ${author} représente une contribution significative au domaine de ${categories}. L'œuvre présente une analyse exhaustive de concepts fondamentaux, offrant des perspectives uniques et des méthodologies innovantes. L'auteur développe des arguments solides soutenus par une recherche rigoureuse, fournissant aux lecteurs des outils précieux pour comprendre des sujets complexes.`
      }
    };

    const template = templates[language] || templates['en'];

    return {
      short: template.short.substring(0, 300),
      detailed: template.detailed.substring(0, 1000)
    };
  }

  private generateFallbackSummary(bookData: BookMetadata, language: string): BookSummary {
    const description = bookData.description;

    if (!description || description === 'No description available.') {
      throw new Error('No description available to generate summary from.');
    }

    const shortSummary = this.generateShortSummary(description, bookData);
    const detailedSummary = this.generateDetailedSummary(description, bookData);

    return {
      short: shortSummary,
      detailed: detailedSummary,
      language: language,
      generatedAt: new Date()
    };
  }

  private generateShortSummary(description: string, bookData: BookMetadata): string {
    const title = bookData.title;
    const author = bookData.authors[0];
    const category = bookData.categories[0];

    const keyPhrases = this.extractKeyPhrases(description);
    const mainTheme = keyPhrases[0] || 'explores important themes';

    const templates = [
      `"${title}" by ${author} is a ${category.toLowerCase()} that ${mainTheme}. This work examines core concepts and provides insights into its subject matter.`,
      `In "${title}", ${author} presents a comprehensive ${category.toLowerCase()} exploring ${mainTheme}. The book offers valuable perspectives on its central themes.`,
      `${author}'s "${title}" delivers a thought-provoking ${category.toLowerCase()} that ${mainTheme}, providing readers with essential insights and analysis.`
    ];

    const templateIndex = title.length % templates.length;
    let summary = templates[templateIndex];

    if (summary.length > 297) {
      summary = summary.substring(0, 297) + '...';
    }

    return summary;
  }

  private generateDetailedSummary(description: string, bookData: BookMetadata): string {
    const title = bookData.title;
    const authors = bookData.authors.join(', ');
    const publisher = bookData.publisher;
    const year = bookData.publishedDate.split('-')[0];
    const pages = bookData.pageCount;
    const categories = bookData.categories.join(', ');

    let summary = `"${title}" by ${authors} (${publisher}, ${year}) is a ${pages}-page work in ${categories}. `;

    const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const keyContent = this.structureContent(sentences);

    summary += keyContent;

    if (bookData.averageRating > 0) {
      const ratingText = this.generateRatingAnalysis(bookData.averageRating, bookData.ratingsCount);
      summary += ` ${ratingText}`;
    }

    if (summary.length > 997) {
      summary = summary.substring(0, 997) + '...';
    }

    return summary;
  }

  private extractKeyPhrases(text: string): string[] {
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'will', 'would', 'could', 'should'];

    const words = text.toLowerCase().split(/\W+/);
    const phrases = [];

    for (let i = 0; i < words.length - 1; i++) {
      const word1 = words[i];
      const word2 = words[i + 1];

      if (word1.length > 4 && word2.length > 4 &&
        !commonWords.includes(word1) && !commonWords.includes(word2)) {
        phrases.push(`${word1} ${word2}`);
      }
    }

    return phrases.slice(0, 5);
  }

  private structureContent(sentences: string[]): string {
    const introduction = sentences[0] || '';
    const bodyContent = sentences.slice(1, 3).join('. ');
    const conclusion = sentences[sentences.length - 1] || '';

    let structured = introduction.trim();
    if (bodyContent) {
      structured += '. ' + bodyContent.trim();
    }
    if (conclusion && conclusion !== introduction) {
      structured += '. ' + conclusion.trim();
    }

    return structured + '.';
  }

  private generateRatingAnalysis(rating: number, count: number): string {
    if (rating >= 4.5) {
      return `The book has received exceptional critical acclaim with an average rating of ${rating}/5 from ${count} readers, indicating widespread appreciation for its quality and insights.`;
    } else if (rating >= 4.0) {
      return `With a strong average rating of ${rating}/5 from ${count} readers, the book has been well-received and praised for its contributions to the field.`;
    } else if (rating >= 3.5) {
      return `The book maintains a solid average rating of ${rating}/5 from ${count} readers, reflecting generally positive reception.`;
    } else {
      return `The book has received an average rating of ${rating}/5 from ${count} readers, with mixed reviews highlighting both strengths and areas for improvement.`;
    }
  }

  async calculateConfidenceMetrics(bookData: BookMetadata, summaries: BookSummary, aiSummary?: AIBookSummary): Promise<ConfidenceMetrics> {
    try {
      const usesFallback = !aiSummary || (aiSummary as any).processingMethod === 'fallback_template';
      const translationApplied = bookData.language !== summaries.language;

      const { confidence } = this.calculateDetailedConfidence(
        bookData,
        aiSummary,
        usesFallback,
        translationApplied
      );

      return confidence;

    } catch (error) {
      console.error('Error calculating confidence metrics:', error);
      throw new Error('Failed to calculate confidence metrics.');
    }
  }

  private calculateDetailedConfidence(
    bookData: BookMetadata,
    aiSummary?: any,
    usesFallback: boolean = false,
    translationApplied: boolean = false
  ): { confidence: ConfidenceMetrics, sourceAttribution: any[] } {

    const descriptionLength = bookData.description?.length || 0;
    const hasCompleteMetadata = !!(bookData.title && bookData.authors?.length && bookData.publisher && bookData.publishedDate);
    const pageCountAvailable = bookData.pageCount > 0;
    const categoriesAvailable = bookData.categories?.length > 0;

    const dataQualityScore = Math.min(100, (
      (descriptionLength > 100 ? 30 : descriptionLength / 100 * 30) +
      (hasCompleteMetadata ? 25 : 0) +
      (pageCountAvailable ? 15 : 0) +
      (categoriesAvailable ? 15 : 0) +
      (bookData.averageRating > 0 ? 10 : 0) +
      (bookData.ratingsCount > 0 ? 5 : 0)
    ));

    const publisherReliability = bookData.publisher !== 'Unknown Publisher' ? 80 : 40;
    const authorCredibility = bookData.authors?.[0] !== 'Unknown Author' ? 70 : 30;
    const metadataCompleteness = hasCompleteMetadata ? 90 : 50;

    const sourceReliabilityScore = Math.min(100, (
      publisherReliability * 0.3 +
      authorCredibility * 0.3 +
      metadataCompleteness * 0.4
    ));

    const topicCoverage = Math.min(100, descriptionLength / 10);
    const thematicDepth = categoriesAvailable ? 80 : 40;
    const conceptualClarity = descriptionLength > 200 ? 90 : 60;

    const contentCoverageScore = Math.min(100, (
      topicCoverage * 0.4 +
      thematicDepth * 0.3 +
      conceptualClarity * 0.3
    ));

    const languageConsistency = usesFallback ? 95 : 85;
    const translationQuality = translationApplied ? 75 : 95;
    const summarizationAccuracy = usesFallback ? 80 : 90;
    const responseCoherence = usesFallback ? 85 : 95;

    const aiProcessingScore = Math.min(100, (
      languageConsistency * 0.3 +
      translationQuality * 0.3 +
      summarizationAccuracy * 0.2 +
      responseCoherence * 0.2
    ));

    const multiSourceVerification = hasCompleteMetadata ? 80 : 50;
    const factualConsistency = 85;
    const contextualRelevance = categoriesAvailable ? 90 : 70;
    const logicalCoherence = 90;

    const crossValidationScore = Math.min(100, (
      multiSourceVerification * 0.3 +
      factualConsistency * 0.2 +
      contextualRelevance * 0.3 +
      logicalCoherence * 0.2
    ));

    const translationPenalty = translationApplied ? 10 : 0;

    const overallScore = Math.max(0, Math.min(100, (
      dataQualityScore * 0.25 +
      sourceReliabilityScore * 0.25 +
      contentCoverageScore * 0.2 +
      aiProcessingScore * 0.15 +
      crossValidationScore * 0.15
    ) - translationPenalty));

    const sourceAttribution = [
      {
        type: 'book_description',
        content: bookData.description?.substring(0, 200) + '...' || 'No description available',
        reliability: descriptionLength > 100 ? 90 : 60,
        relevance: 95,
        length: descriptionLength,
        source: 'Google Books API',
        weight: descriptionLength > 0 ? 0.4 : 0
      },
      {
        type: 'metadata',
        content: `Title: ${bookData.title}, Authors: ${bookData.authors?.join(', ')}, Publisher: ${bookData.publisher}`,
        reliability: hasCompleteMetadata ? 95 : 70,
        relevance: 80,
        length: bookData.title?.length + (bookData.authors?.join(', ').length || 0),
        source: 'Google Books API',
        weight: 0.3
      },
      {
        type: 'category_data',
        content: bookData.categories?.join(', ') || 'Uncategorized',
        reliability: categoriesAvailable ? 85 : 40,
        relevance: 75,
        length: bookData.categories?.join(', ').length || 0,
        source: 'Google Books API',
        weight: categoriesAvailable ? 0.15 : 0.05
      },
      {
        type: usesFallback ? 'fallback_template' : 'ai_knowledge',
        content: usesFallback ? 'Language-specific template' : 'OpenAI GPT knowledge base',
        reliability: usesFallback ? 85 : 90,
        relevance: 70,
        length: 0,
        source: usesFallback ? 'SmartLibroAI Template' : 'OpenAI GPT-3.5',
        weight: usesFallback ? 0.15 : 0.15
      }
    ];

    const confidenceMetrics: ConfidenceMetrics = {
      overallScore: Math.round(overallScore),
      sourceReliability: Math.round(sourceReliabilityScore),
      contentCoverage: Math.round(contentCoverageScore),
      crossReferenceValidation: Math.round(crossValidationScore),
      factors: {
        sourcesUsed: sourceAttribution.filter(s => s.weight > 0).length,
        averageSourceRating: Math.round(sourceAttribution.reduce((sum, s) => sum + s.reliability, 0) / sourceAttribution.length),
        descriptionLength,
        reviewsCount: bookData.ratingsCount || 0,
        dataQualityScore: Math.round(dataQualityScore),
        aiProcessingScore: Math.round(aiProcessingScore),
        translationPenalty
      },
      detailedBreakdown: {
        dataQuality: Math.round(dataQualityScore),
        sourceReliability: Math.round(sourceReliabilityScore),
        contentCoverage: Math.round(contentCoverageScore),
        aiProcessing: Math.round(aiProcessingScore),
        crossValidation: Math.round(crossValidationScore)
      },
      sourceAttribution
    };

    return { confidence: confidenceMetrics, sourceAttribution };
  }

  async saveToUserLibrary(item: UserLibraryItem): Promise<string> {
    try {
      const currentUser = await new Promise<any>((resolve) => {
        this.authService.user$.subscribe(user => {
          if (user) resolve(user);
        });
      });

      if (!currentUser) {
        throw new Error('User must be logged in to save books to library');
      }

      const userId = currentUser.uid;

      const libraryItemData = {
        ...item,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        summaries: {
          ...item.summaries,
          generatedAt: item.summaries.generatedAt
        }
      };

      delete libraryItemData.id;

      const librariesRef = collection(this.firestore, 'libraries');
      const docRef = await addDoc(librariesRef, libraryItemData);

      const userLibrary = await this.getUserLibrary();
      await this.userService.updateLibraryCount(userId, userLibrary.length + 1);

      return docRef.id;

    } catch (error) {
      console.error('Error saving to library:', error);
      throw new Error('Failed to save book to library.');
    }
  }

  async getUserLibrary(): Promise<UserLibraryItem[]> {
    try {
      const currentUser = await new Promise<any>((resolve) => {
        this.authService.user$.subscribe(user => {
          if (user) resolve(user);
        });
      });

      if (!currentUser) {

        return [];
      }

      const userId = currentUser.uid;

      const librariesRef = collection(this.firestore, 'libraries');
      const q = query(
        librariesRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const libraryItems: UserLibraryItem[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        libraryItems.push({
          id: doc.id,
          ...data,

          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate(),
          summaries: {
            ...data['summaries'],
            generatedAt: data['summaries']['generatedAt'] instanceof Date
              ? data['summaries']['generatedAt']
              : new Date(data['summaries']['generatedAt'])
          }
        } as UserLibraryItem);
      });

      console.log(`Retrieved ${libraryItems.length} books from user library`);
      return libraryItems;

    } catch (error) {
      console.error('Error getting user library:', error);
      return [];
    }
  }

  async getLibraryItemById(itemId: string): Promise<UserLibraryItem | null> {
    try {
      const docRef = doc(this.firestore, 'libraries', itemId);
      const docSnapshot = await getDoc(docRef);

      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...data,
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate(),
          summaries: {
            ...data['summaries'],
            generatedAt: data['summaries']['generatedAt'] instanceof Date
              ? data['summaries']['generatedAt']
              : new Date(data['summaries']['generatedAt'])
          }
        } as UserLibraryItem;
      } else {
        console.log('Library item not found:', itemId);
        return null;
      }
    } catch (error) {
      console.error('Error getting library item:', error);
      throw new Error('Failed to get library item');
    }
  }

  async updateLibraryItem(itemId: string, updates: Partial<UserLibraryItem>): Promise<void> {
    try {
      const currentUser = await new Promise<any>((resolve) => {
        this.authService.user$.subscribe(user => {
          if (user) resolve(user);
        });
      });

      if (!currentUser) {
        throw new Error('User must be logged in to update library items');
      }

      const existingItem = await this.getLibraryItemById(itemId);
      if (!existingItem || existingItem.userId !== currentUser.uid) {
        throw new Error('Unauthorized: Item does not belong to current user');
      }

      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      };

      delete updateData.id;
      delete updateData.userId;

      const docRef = doc(this.firestore, 'libraries', itemId);
      await updateDoc(docRef, updateData);

    } catch (error) {
      console.error('Error updating library item:', error);
      throw new Error('Failed to update library item');
    }
  }

  async deleteFromUserLibrary(itemId: string): Promise<void> {
    try {
      const currentUser = await new Promise<any>((resolve) => {
        this.authService.user$.subscribe(user => {
          if (user) resolve(user);
        });
      });

      if (!currentUser) {
        throw new Error('User must be logged in to delete library items');
      }

      const userId = currentUser.uid;

      const existingItem = await this.getLibraryItemById(itemId);
      if (!existingItem || existingItem.userId !== userId) {
        throw new Error('Unauthorized: Item does not belong to current user');
      }

      const docRef = doc(this.firestore, 'libraries', itemId);
      await deleteDoc(docRef);

      console.log('Book deleted from library:', itemId);

      const userLibrary = await this.getUserLibrary();
      await this.userService.updateLibraryCount(userId, userLibrary.length);

    } catch (error) {
      console.error('Error deleting from library:', error);
      throw new Error('Failed to delete book from library.');
    }
  }

  async searchUserLibrary(searchTerm: string): Promise<UserLibraryItem[]> {
    try {
      const userLibrary = await this.getUserLibrary();

      if (!searchTerm.trim()) {
        return userLibrary;
      }

      const lowercaseSearch = searchTerm.toLowerCase();

      return userLibrary.filter(item =>
        item.bookData.title.toLowerCase().includes(lowercaseSearch) ||
        item.bookData.authors.some(author => author.toLowerCase().includes(lowercaseSearch)) ||
        item.bookData.categories.some(category => category.toLowerCase().includes(lowercaseSearch)) ||
        item.bookData.publisher.toLowerCase().includes(lowercaseSearch)
      );

    } catch (error) {
      console.error('Error searching user library:', error);
      return [];
    }
  }

  async getLibraryStats(): Promise<{
    totalBooks: number;
    averageConfidence: number;
    languageDistribution: Record<string, number>;
    categoryDistribution: Record<string, number>;
  }> {
    try {
      const userLibrary = await this.getUserLibrary();

      const stats = {
        totalBooks: userLibrary.length,
        averageConfidence: 0,
        languageDistribution: {} as Record<string, number>,
        categoryDistribution: {} as Record<string, number>
      };

      if (userLibrary.length === 0) {
        return stats;
      }

      const totalConfidence = userLibrary.reduce((sum, item) => sum + item.confidenceMetrics.overallScore, 0);
      stats.averageConfidence = Math.round(totalConfidence / userLibrary.length);

      userLibrary.forEach(item => {
        const lang = item.summaries.language;
        stats.languageDistribution[lang] = (stats.languageDistribution[lang] || 0) + 1;
      });

      const categoryCount: Record<string, number> = {};
      userLibrary.forEach(item => {
        item.bookData.categories.forEach(category => {
          categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
      });

      const sortedCategories = Object.entries(categoryCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      sortedCategories.forEach(([category, count]) => {
        stats.categoryDistribution[category] = count;
      });

      return stats;

    } catch (error) {
      console.error('Error getting library stats:', error);
      return {
        totalBooks: 0,
        averageConfidence: 0,
        languageDistribution: {},
        categoryDistribution: {}
      };
    }
  }

  private validateAndCleanSummaryLanguage(aiSummary: any, targetLanguage: string): any {
    if (!aiSummary || targetLanguage === 'en') {
      return aiSummary;
    }

    const targetReplacements = LANGUAGE_REPLACEMENTS[targetLanguage] || {};
    const phrasePatterns = LANGUAGE_PHRASE_PATTERNS[targetLanguage] || {};
    const wordPatterns = LANGUAGE_WORD_PATTERNS[targetLanguage] || {};

    let hasChanges = false;
    let shortSummary = aiSummary.shortSummary || '';
    const originalShort = shortSummary;

    Object.entries(phrasePatterns).forEach(([pattern, replacement]) => {
      const regex = new RegExp(pattern, 'gi');
      if (regex.test(shortSummary)) {
        shortSummary = shortSummary.replace(regex, replacement);
        hasChanges = true;
      }
    });

    Object.entries(wordPatterns).forEach(([word, replacement]) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(shortSummary)) {
        shortSummary = shortSummary.replace(regex, replacement);
        hasChanges = true;
      }
    });

    FORBIDDEN_ENGLISH_WORDS.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(shortSummary) && targetReplacements[word.toLowerCase()]) {
        shortSummary = shortSummary.replace(regex, targetReplacements[word.toLowerCase()]);
        hasChanges = true;
      }
    });

    let detailedSummary = aiSummary.detailedSummary || '';
    const originalDetailed = detailedSummary;

    Object.entries(phrasePatterns).forEach(([pattern, replacement]) => {
      const regex = new RegExp(pattern, 'gi');
      if (regex.test(detailedSummary)) {
        detailedSummary = detailedSummary.replace(regex, replacement);
        hasChanges = true;
      }
    });

    Object.entries(wordPatterns).forEach(([word, replacement]) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(detailedSummary)) {
        detailedSummary = detailedSummary.replace(regex, replacement);
        hasChanges = true;
      }
    });

    FORBIDDEN_ENGLISH_WORDS.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(detailedSummary) && targetReplacements[word.toLowerCase()]) {
        detailedSummary = detailedSummary.replace(regex, targetReplacements[word.toLowerCase()]);
        hasChanges = true;
      }
    }); if (hasChanges) {
      console.warn('Language mixing detected and corrected!');
    }

    return {
      ...aiSummary,
      shortSummary: shortSummary !== originalShort ? shortSummary : aiSummary.shortSummary,
      detailedSummary: detailedSummary !== originalDetailed ? detailedSummary : aiSummary.detailedSummary
    };
  }
}
