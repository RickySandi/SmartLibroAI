import { AIBookSummary } from './ai-summary.interface';

export interface CloudFunctionResponse {
    success: boolean;
    data?: AIBookSummary;
    error?: string;
}
