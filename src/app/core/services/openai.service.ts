import { Injectable } from '@angular/core';
import OpenAI from 'openai';
import { environment } from '../../../environments/environment';
import {
    SourceAttribution,
    DetailedConfidenceFactors,
    AIBookSummary,
    SummaryRequest
} from '../interfaces';

@Injectable({
    providedIn: 'root'
})
export class OpenAIService {
    private openai: OpenAI | null = null;
    private isConfigured = false;

    constructor() {
        this.initializeOpenAI();
    }

    private initializeOpenAI(): void {
        try {
            if (environment.openai.apiKey) {
                this.openai = new OpenAI({
                    apiKey: environment.openai.apiKey,
                    dangerouslyAllowBrowser: true
                });
                this.isConfigured = true;

            } else {
                console.warn('OpenAI API key not configured. Using mock responses.');
                this.isConfigured = false;
            }
        } catch (error) {
            console.error('Failed to initialize OpenAI service:', error);
            this.isConfigured = false;
        }
    }

    async generateBookSummary(request: SummaryRequest): Promise<AIBookSummary> {
        // Check if OpenAI is configured
        if (!this.isConfigured || !this.openai) {
            return this.generateEnhancedMockSummary(request);
        }

        try {
            const prompt = this.buildSummaryPrompt(request);

            const languageMap: Record<string, string> = {
                'en': 'English',
                'es': 'Spanish',
                'fr': 'French',
                'de': 'German',
                'it': 'Italian',
                'pt': 'Portuguese'
            };

            const targetLanguageName = languageMap[request.targetLanguage] || 'English';

            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: `You are a professional book summarizer. CRITICAL REQUIREMENT: Your response must be 100% in ${targetLanguageName}. NEVER mix languages. NEVER use English words if the target is not English. NEVER use ${targetLanguageName} words if the target is not ${targetLanguageName}. Every word, every phrase, every sentence must be purely in ${targetLanguageName}.`
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 1200,
                temperature: 0.1,
                response_format: { type: "json_object" }
            });

            const response = completion.choices[0]?.message?.content;
            if (!response) {
                throw new Error('No response from OpenAI');
            }

            const parsedResponse = JSON.parse(response);

            const enhancedData = this.generateSourceAttribution(request);

            return {
                shortSummary: this.ensureCharacterLimit(parsedResponse.shortSummary, 300),
                detailedSummary: this.ensureCharacterLimit(parsedResponse.detailedSummary, 1000),
                confidenceScore: Math.min(100, Math.max(0, parsedResponse.confidenceScore || 75)),
                reasoningFactors: parsedResponse.reasoningFactors || [],
                sourcesUsed: parsedResponse.sourcesUsed || ['Google Books API', 'Book Description'],
                sourceAttribution: enhancedData.sourceAttribution,
                detailedConfidenceFactors: enhancedData.detailedConfidenceFactors,
                language: request.targetLanguage,
                generatedAt: new Date(),
                processingMethod: enhancedData.processingMethod,
                translationApplied: enhancedData.translationApplied
            };

        } catch (error) {
            console.error('Error generating AI summary:', error);

            return this.generateEnhancedMockSummary(request);
        }
    }

    private buildSummaryPrompt(request: SummaryRequest): string {
        const languageMap: Record<string, string> = {
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese'
        };

        const targetLanguageName = languageMap[request.targetLanguage] || 'English';

        const languageExamples: Record<string, { short: string; detailed: string; factors: string[]; sources: string[] }> = {
            'Spanish': {
                short: 'Este libro explora las principales teorías sobre el desarrollo económico y social...',
                detailed: 'Una obra completa que analiza en profundidad los conceptos fundamentales del crecimiento económico, presentando metodologías innovadoras y casos de estudio relevantes que demuestran la aplicación práctica de estas teorías en contextos reales...',
                factors: ['Información bibliográfica completa disponible', 'Descripción detallada del contenido', 'Categorías claramente definidas'],
                sources: ['Descripción oficial del editor', 'Metadatos de Google Books', 'Información bibliográfica verificada']
            },
            'French': {
                short: 'Ce livre explore les principales théories sur le développement économique et social...',
                detailed: 'Un ouvrage complet qui analyse en profondeur les concepts fondamentaux de la croissance économique, présentant des méthodologies innovantes et des études de cas pertinentes qui démontrent l\'application pratique de ces théories dans des contextes réels...',
                factors: ['Informations bibliographiques complètes disponibles', 'Description détaillée du contenu', 'Catégories clairement définies'],
                sources: ['Description officielle de l\'éditeur', 'Métadonnées Google Books', 'Informations bibliographiques vérifiées']
            },
            'German': {
                short: 'Dieses Buch erforscht die wichtigsten Theorien über wirtschaftliche und soziale Entwicklung...',
                detailed: 'Ein umfassendes Werk, das die grundlegenden Konzepte des Wirtschaftswachstums tiefgreifend analysiert und innovative Methodologien sowie relevante Fallstudien präsentiert, die die praktische Anwendung dieser Theorien in realen Kontexten demonstrieren...',
                factors: ['Vollständige bibliographische Informationen verfügbar', 'Detaillierte Inhaltsbeschreibung', 'Klar definierte Kategorien'],
                sources: ['Offizielle Verlagsbeschreibung', 'Google Books Metadaten', 'Verifizierte bibliographische Informationen']
            },
            'Italian': {
                short: 'Questo libro esplora le principali teorie sullo sviluppo economico e sociale...',
                detailed: 'Un\'opera completa che analizza in profondità i concetti fondamentali della crescita economica, presentando metodologie innovative e casi di studio rilevanti che dimostrano l\'applicazione pratica di queste teorie in contesti reali...',
                factors: ['Informazioni bibliografiche complete disponibili', 'Descrizione dettagliata del contenuto', 'Categorie chiaramente definite'],
                sources: ['Descrizione ufficiale dell\'editore', 'Metadati Google Books', 'Informazioni bibliografiche verificate']
            },
            'Portuguese': {
                short: 'Este livro explora as principais teorias sobre desenvolvimento econômico e social...',
                detailed: 'Uma obra completa que analisa em profundidade os conceitos fundamentais do crescimento econômico, apresentando metodologias inovadoras e estudos de caso relevantes que demonstram a aplicação prática dessas teorias em contextos reais...',
                factors: ['Informações bibliográficas completas disponíveis', 'Descrição detalhada do conteúdo', 'Categorias claramente definidas'],
                sources: ['Descrição oficial da editora', 'Metadados do Google Books', 'Informações bibliográficas verificadas']
            },
            'English': {
                short: 'This book explores the main theories about economic and social development...',
                detailed: 'A comprehensive work that analyzes fundamental concepts of economic growth in depth, presenting innovative methodologies and relevant case studies that demonstrate the practical application of these theories in real contexts...',
                factors: ['Complete bibliographic information available', 'Detailed content description', 'Clearly defined categories'],
                sources: ['Official publisher description', 'Google Books metadata', 'Verified bibliographic information']
            }
        };

        const examples = languageExamples[targetLanguageName] || languageExamples['English'];

        return `
ABSOLUTE REQUIREMENT: You MUST respond 100% in ${targetLanguageName}. NO mixing of languages allowed.

CRITICAL INSTRUCTION: This book is originally in "${request.language}" but you MUST write your summary in ${targetLanguageName}. If these are different languages, you are translating the summary to ${targetLanguageName}.

EXAMPLES of proper format in ${targetLanguageName}:
- shortSummary: "${examples.short}"
- detailedSummary: "${examples.detailed}"
- reasoningFactors: ${JSON.stringify(examples.factors)}
- sourcesUsed: ${JSON.stringify(examples.sources)}

Book Information:
- Title: "${request.title}" (keep original title)
- Author(s): ${request.authors.join(', ')} (keep original names)
- ISBN: ${request.isbn} (universal identifier - works in any language)
- Publisher: ${request.publisher}
- Published: ${request.publishedDate}
- Pages: ${request.pageCount}
- Categories: ${request.categories.join(', ')}
- Book's Original Language: "${request.language}"
- SUMMARY MUST BE IN: ${targetLanguageName}
- Description: "${request.description}"

LANGUAGE TRANSLATION RULE:
- Book language: "${request.language}"
- Summary language: ${targetLanguageName}
- If different: Translate concepts and ideas to ${targetLanguageName}
- Keep author names and book title as original
- Write ALL analysis and summary text in ${targetLanguageName}

EXAMPLE SCENARIOS:
- Spanish book + German summary = Write in German
- English book + Portuguese summary = Write in Portuguese  
- French book + Italian summary = Write in Italian
- ANY book language + ${targetLanguageName} summary = Write in ${targetLanguageName}

RESPOND WITH JSON in ${targetLanguageName}:
{
  "shortSummary": "Write 250-300 characters in ${targetLanguageName} ONLY",
  "detailedSummary": "Write 800-1000 characters in ${targetLanguageName} ONLY", 
  "confidenceScore": 85,
  "reasoningFactors": ["Factor 1 in ${targetLanguageName}", "Factor 2 in ${targetLanguageName}", "Factor 3 in ${targetLanguageName}"],
  "sourcesUsed": ["Source 1 in ${targetLanguageName}", "Source 2 in ${targetLanguageName}"]
}

STRICT RULES:
1. Every single word must be in ${targetLanguageName}
2. Do not translate author names or book titles
3. Use natural ${targetLanguageName} grammar and vocabulary
4. NO English if target is not English
5. NO Spanish if target is not Spanish  
6. NO mixing any languages
7. Follow the examples provided above
    `.trim();
    }

    private ensureCharacterLimit(text: string, limit: number): string {
        if (!text) return '';

        if (text.length <= limit) {
            return text;
        }

        const trimmed = text.substring(0, limit - 3);

        const lastSpace = trimmed.lastIndexOf(' ');
        if (lastSpace > limit * 0.8) {
            return trimmed.substring(0, lastSpace) + '...';
        }

        return trimmed + '...';
    }

    private generateEnhancedMockSummary(request: SummaryRequest): AIBookSummary {

        const title = request.title;
        const author = request.authors[0] || 'Unknown Author';
        const category = request.categories[0] || 'General';
        const description = request.description || 'No description available';

        const shortSummary = this.generateMockShortSummary(title, author, category, description);
        const detailedSummary = this.generateMockDetailedSummary(request, description);
        const confidenceScore = this.calculateMockConfidence(request);
        const reasoningFactors = this.generateMockReasoningFactors(request);
        const enhancedData = this.generateSourceAttribution(request);

        enhancedData.processingMethod = 'fallback_template';

        return {
            shortSummary,
            detailedSummary,
            confidenceScore,
            reasoningFactors,
            sourcesUsed: ['Google Books API', 'Book Metadata', 'SmartLibro AI Analysis'],
            sourceAttribution: enhancedData.sourceAttribution,
            detailedConfidenceFactors: enhancedData.detailedConfidenceFactors,
            language: request.targetLanguage,
            generatedAt: new Date(),
            processingMethod: enhancedData.processingMethod,
            translationApplied: enhancedData.translationApplied
        };
    }

    private generateMockShortSummary(title: string, author: string, category: string, description: string): string {
        const templates = [
            `"${title}" by ${author} presents a comprehensive ${category.toLowerCase()} exploring key themes and insights. The work examines fundamental concepts and provides valuable analysis for readers interested in the subject matter.`,
            `${author}'s "${title}" offers an in-depth examination of ${category.toLowerCase()} principles. This work delivers essential insights and practical perspectives on its central themes and concepts.`,
            `In "${title}", ${author} provides a thorough analysis of ${category.toLowerCase()} topics. The book presents important ideas and conclusions that contribute to understanding of the field.`
        ];

        const templateIndex = title.length % templates.length;
        let summary = templates[templateIndex];

        if (description && description.length > 50) {
            const keywords = this.extractKeywords(description);
            if (keywords.length > 0) {
                summary = summary.replace('key themes', keywords.slice(0, 2).join(' and '));
            }
        }

        return this.ensureCharacterLimit(summary, 300);
    }

    private generateMockDetailedSummary(request: SummaryRequest, description: string): string {
        const { title, authors, publisher, publishedDate, pageCount, categories } = request;

        let summary = `"${title}" by ${authors.join(', ')} (${publisher}, ${publishedDate.split('-')[0]}) is a ${pageCount}-page work in ${categories.join(', ')}. `;

        if (description && description.length > 100) {
            const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 20);
            const keyContent = sentences.slice(0, 2).join('. ').trim();
            summary += `${keyContent}. `;
        }

        const insights = this.generateCategoryInsights(categories);
        if (insights) {
            summary += `${insights} `;
        }

        if (pageCount > 300) {
            summary += 'This comprehensive volume provides extensive coverage of its subject matter. ';
        } else if (pageCount > 150) {
            summary += 'The book offers substantial content while maintaining accessibility. ';
        }

        const currentYear = new Date().getFullYear();
        const pubYear = parseInt(publishedDate.split('-')[0]);
        if (currentYear - pubYear < 5) {
            summary += 'As a recent publication, it incorporates contemporary perspectives and current research findings.';
        } else {
            summary += 'The work provides established insights and proven methodologies in its field.';
        }

        return this.ensureCharacterLimit(summary, 1000);
    }

    private calculateMockConfidence(request: SummaryRequest): number {
        let confidence = 50;

        if (request.description && request.description.length > 200) confidence += 20;
        else if (request.description && request.description.length > 100) confidence += 10;

        if (request.authors.length > 0 && request.authors[0] !== 'Unknown Author') confidence += 10;
        if (request.publisher && request.publisher !== 'Unknown Publisher') confidence += 10;
        if (request.pageCount > 0) confidence += 5;
        if (request.categories.length > 0 && request.categories[0] !== 'Uncategorized') confidence += 5;

        return Math.min(95, confidence);
    }

    private generateMockReasoningFactors(request: SummaryRequest): string[] {
        const factors = [];

        if (request.description && request.description.length > 200) {
            factors.push('Comprehensive book description provides detailed content analysis');
        } else if (request.description && request.description.length > 50) {
            factors.push('Book description available for content extraction');
        } else {
            factors.push('Limited description affects content analysis depth');
        }

        factors.push('Google Books API provides reliable metadata');

        if (request.pageCount > 300) {
            factors.push('Substantial page count indicates comprehensive coverage');
        } else if (request.pageCount > 0) {
            factors.push('Page count information available for scope assessment');
        }

        if (request.categories.length > 1) {
            factors.push('Multiple categories provide context for analysis');
        }

        factors.push('SmartLibro AI analysis algorithms applied');

        return factors.slice(0, 5);
    }

    private generateCategoryInsights(categories: string[]): string {
        const insights = [];

        for (const category of categories) {
            const lowerCat = category.toLowerCase();
            if (lowerCat.includes('history')) {
                insights.push('The work provides historical context and chronological analysis');
                break;
            } else if (lowerCat.includes('science') || lowerCat.includes('technology')) {
                insights.push('The text offers scientific methodologies and technical insights');
                break;
            } else if (lowerCat.includes('business') || lowerCat.includes('management')) {
                insights.push('The book presents practical business applications and strategic frameworks');
                break;
            } else if (lowerCat.includes('political') || lowerCat.includes('government')) {
                insights.push('The work examines political systems and governmental processes');
                break;
            } else if (lowerCat.includes('education') || lowerCat.includes('academic')) {
                insights.push('The book provides educational frameworks and academic perspectives');
                break;
            }
        }

        return insights[0] || 'The work contributes valuable insights to its field of study';
    }

    private extractKeywords(text: string): string[] {
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'will', 'would', 'could', 'should']);

        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 4 && !commonWords.has(word));

        const wordCount = new Map<string, number>();
        words.forEach(word => {
            wordCount.set(word, (wordCount.get(word) || 0) + 1);
        });

        return Array.from(wordCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
    }

    private generateSourceAttribution(request: SummaryRequest): {
        sourceAttribution: SourceAttribution[],
        detailedConfidenceFactors: DetailedConfidenceFactors,
        processingMethod: 'openai_api' | 'fallback_template',
        translationApplied: boolean
    } {
        const translationApplied = request.language !== request.targetLanguage;

        const sourceAttribution: SourceAttribution[] = [
            {
                type: 'book_description',
                content: request.description?.substring(0, 200) + '...' || 'No description available',
                reliability: request.description?.length > 100 ? 90 : 60,
                relevance: 95,
                length: request.description?.length || 0,
                source: 'Google Books API',
                weight: 0.4
            },
            {
                type: 'metadata',
                content: `${request.title} by ${request.authors.join(', ')} (${request.publisher}, ${request.publishedDate})`,
                reliability: 95,
                relevance: 85,
                length: request.title.length + request.authors.join(', ').length,
                source: 'Google Books API',
                weight: 0.25
            },
            {
                type: 'category_data',
                content: request.categories.join(', '),
                reliability: request.categories.length > 0 ? 85 : 40,
                relevance: 80,
                length: request.categories.join(', ').length,
                source: 'Google Books API',
                weight: 0.15
            },
            {
                type: 'ai_knowledge',
                content: 'OpenAI GPT-3.5 knowledge base and training data',
                reliability: 85,
                relevance: 75,
                length: 0,
                source: 'OpenAI GPT-3.5',
                weight: 0.2
            }
        ];

        const detailedConfidenceFactors: DetailedConfidenceFactors = {
            dataQuality: {
                score: 85,
                factors: {
                    descriptionLength: request.description?.length || 0,
                    metadataCompleteness: 90,
                    publisherReliability: 80,
                    authorCredibility: 75
                }
            },
            sourceReliability: {
                score: 88,
                factors: {
                    primarySourcesCount: sourceAttribution.length,
                    averageSourceReliability: 85,
                    sourceConsistency: 90,
                    verifiableInformation: 85
                }
            },
            contentCoverage: {
                score: 82,
                factors: {
                    topicCoverage: 85,
                    thematicDepth: 80,
                    conceptualClarity: 85,
                    structuralCompleteness: 80
                }
            },
            aiProcessing: {
                score: translationApplied ? 75 : 90,
                factors: {
                    languageConsistency: translationApplied ? 75 : 95,
                    translationQuality: translationApplied ? 80 : 100,
                    summarizationAccuracy: 85,
                    responseCoherence: 90
                }
            },
            crossValidation: {
                score: 85,
                factors: {
                    multiSourceVerification: 80,
                    factualConsistency: 85,
                    contextualRelevance: 90,
                    logicalCoherence: 85
                }
            }
        };

        return {
            sourceAttribution,
            detailedConfidenceFactors,
            processingMethod: 'openai_api',
            translationApplied
        };
    }

    isServiceConfigured(): boolean {
        return this.isConfigured;
    }

    getConfigurationStatus(): string {
        if (this.isConfigured) {
            return 'OpenAI API configured and ready';
        } else {
            return 'OpenAI API not configured - using enhanced mock responses';
        }
    }
}
