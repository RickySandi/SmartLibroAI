import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfidenceMetrics, AIBookSummary } from '../../core/interfaces';

@Component({
    selector: 'app-confidence-metrics',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './confidence-metrics.component.html',
    styleUrls: ['./confidence-metrics.component.scss']
})
export class ConfidenceMetricsComponent {
    @Input() confidenceMetrics?: ConfidenceMetrics;
    @Input() aiSummary?: AIBookSummary;

    showDetailedFactors = false;

    getScoreClass(score: number): string {
        if (score >= 80) return 'high-score';
        if (score >= 60) return 'medium-score';
        return 'low-score';
    }

    getBreakdownMetrics() {
        if (!this.confidenceMetrics?.detailedBreakdown) return [];

        return [
            {
                name: 'Data Quality',
                score: this.confidenceMetrics.detailedBreakdown.dataQuality,
                icon: 'fas fa-database'
            },
            {
                name: 'Source Reliability',
                score: this.confidenceMetrics.detailedBreakdown.sourceReliability,
                icon: 'fas fa-shield-alt'
            },
            {
                name: 'Content Coverage',
                score: this.confidenceMetrics.detailedBreakdown.contentCoverage,
                icon: 'fas fa-file-alt'
            },
            {
                name: 'AI Processing',
                score: this.confidenceMetrics.detailedBreakdown.aiProcessing,
                icon: 'fas fa-robot'
            },
            {
                name: 'Cross Validation',
                score: this.confidenceMetrics.detailedBreakdown.crossValidation,
                icon: 'fas fa-check-double'
            }
        ];
    }

    getSourceIcon(type: string): string {
        const icons: Record<string, string> = {
            'book_description': 'fas fa-book',
            'metadata': 'fas fa-tags',
            'ai_knowledge': 'fas fa-brain',
            'fallback_template': 'fas fa-template',
            'category_data': 'fas fa-folder'
        };
        return icons[type] || 'fas fa-file';
    }

    getSourceTypeName(type: string): string {
        const names: Record<string, string> = {
            'book_description': 'Book Description',
            'metadata': 'Book Metadata',
            'ai_knowledge': 'AI Knowledge',
            'fallback_template': 'Template',
            'category_data': 'Category Data'
        };
        return names[type] || type;
    }

    getSourceTypeClass(type: string): string {
        return type.replace(/_/g, '-');
    }

    getProcessingMethodName(method: string): string {
        return method === 'openai_api' ? 'OpenAI API' : 'Template Fallback';
    }

    getDetailedFactors() {
        if (!this.aiSummary?.detailedConfidenceFactors) return [];

        const factors = this.aiSummary.detailedConfidenceFactors;

        return [
            {
                name: 'Data Quality',
                factors: [
                    { label: 'Description Length', value: factors.dataQuality.factors.descriptionLength },
                    { label: 'Metadata Completeness', value: factors.dataQuality.factors.metadataCompleteness + '%' },
                    { label: 'Publisher Reliability', value: factors.dataQuality.factors.publisherReliability + '%' },
                    { label: 'Author Credibility', value: factors.dataQuality.factors.authorCredibility + '%' }
                ]
            },
            {
                name: 'Source Reliability',
                factors: [
                    { label: 'Primary Sources', value: factors.sourceReliability.factors.primarySourcesCount },
                    { label: 'Avg Reliability', value: factors.sourceReliability.factors.averageSourceReliability + '%' },
                    { label: 'Source Consistency', value: factors.sourceReliability.factors.sourceConsistency + '%' },
                    { label: 'Verifiable Info', value: factors.sourceReliability.factors.verifiableInformation + '%' }
                ]
            },
            {
                name: 'AI Processing',
                factors: [
                    { label: 'Language Consistency', value: factors.aiProcessing.factors.languageConsistency + '%' },
                    { label: 'Translation Quality', value: factors.aiProcessing.factors.translationQuality + '%' },
                    { label: 'Summarization', value: factors.aiProcessing.factors.summarizationAccuracy + '%' },
                    { label: 'Response Coherence', value: factors.aiProcessing.factors.responseCoherence + '%' }
                ]
            }
        ];
    }

    toggleDetailedFactors() {
        this.showDetailedFactors = !this.showDetailedFactors;
    }
}
