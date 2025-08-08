import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SummaryRequest, AIBookSummary, CloudFunctionResponse } from '../interfaces';

@Injectable({
    providedIn: 'root'
})
export class CloudFunctionService {
    private readonly FUNCTIONS_BASE_URL = environment.firebase.functionsBaseUrl;
    private lastRequestTime = 0;
    private readonly MIN_REQUEST_INTERVAL = 500;

    constructor(private http: HttpClient) { }

    async generateBookSummary(request: SummaryRequest): Promise<AIBookSummary> {
        //
        return this.generateBookSummaryWithRetry(request, 0);
    } private async generateBookSummaryWithRetry(request: SummaryRequest, attempt: number): Promise<AIBookSummary> {
        const maxAttempts = 3;
        const baseDelay = 1000;
        //

        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
            const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;

            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();

        try {
            const headers = new HttpHeaders({
                'Content-Type': 'application/json'
            });

            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
                const delay = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;

                await new Promise(resolve => setTimeout(resolve, delay));
            }

            const response = await this.http.post<CloudFunctionResponse>(
                this.FUNCTIONS_BASE_URL,
                request,
                { headers }
            ).toPromise();

            this.lastRequestTime = Date.now();

            if (!response) {
                throw new Error('No response from cloud function');
            }

            if (!response.success || !response.data) {
                throw new Error(response.error || 'Failed to generate summary via cloud function');
            }

            return response.data;

        } catch (error: any) {
            console.error(`Error calling cloud function (attempt ${attempt + 1}):`, error);

            const isRateLimit = error?.status === 429 ||
                error?.error?.status === 429 ||
                error?.message?.includes('429') ||
                error?.message?.includes('rate limit') ||
                error?.message?.includes('Too many requests');

            if (isRateLimit && attempt < maxAttempts - 1) {
                const delay = baseDelay * Math.pow(2, attempt);

                await new Promise(resolve => setTimeout(resolve, delay));
                return this.generateBookSummaryWithRetry(request, attempt + 1);
            }

            if (isRateLimit) {
                throw new Error('Rate limit exceeded. Please wait a few minutes before trying again.');
            } else if (error instanceof Error) {
                throw new Error(`Cloud function error: ${error.message}`);
            } else {
                throw new Error('Unknown error occurred while calling cloud function');
            }
        }
    }

    isCloudFunctionEnabled(): boolean {
        return !!environment.firebase.functionsBaseUrl &&
            environment.useCloudFunctions === true;
    }

    getCloudFunctionStatus(): string {
        if (this.isCloudFunctionEnabled()) {
            return 'Cloud Functions enabled for secure AI processing';
        } else {
            return 'Cloud Functions disabled - using client-side AI processing';
        }
    }
}
