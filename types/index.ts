export type AIProvider = 'claude' | 'openai' | 'gemini' | 'grok';

export interface OptimizeRequest {
  content: string;        // User's full blog content
  primaryKeyword: string; // Target SEO keyword
  urls: string[];         // All URLs from uploaded CSV/XLSX
  provider: AIProvider;   // Which AI to use
  apiKey: string;         // User's API key for selected provider
  model?: string;         // Optional specific model override
}

export interface InternalLink {
  anchorText: string; // Exact phrase found word-for-word in content
  url: string;        // Matched URL from spreadsheet
  isLive: boolean;    // Result of HEAD request check
}

export interface OptimizeResponse {
  success: boolean;
  data?: {
    h2: string;
    h3: string;
    paragraph1: string;
    paragraph2: string;
    metaTitle: string;           // Max 55 chars
    metaDescription: string;     // Max 145 chars
    internalLinks: InternalLink[];
    placementRecommendation: string;
    provider: AIProvider;
    tokensUsed?: number;
  };
  error?: string;
}

export interface URLCheckResult {
  url: string;
  isLive: boolean;
  statusCode?: number;
  error?: string;
}

export interface MatchedURL {
  url: string;
  slug: string;
  keywords: string[];        // extracted from slug
  anchorText: string | null; // phrase found in content
  relevanceScore: number;
}

export interface AICallResult {
  text: string;
  tokensUsed?: number;
}

export interface CallProviderArgs {
  provider: AIProvider;
  apiKey: string;
  prompt: string;
  systemPrompt: string;
  model?: string;
}

export interface BuildPromptArgs {
  content: string;
  primaryKeyword: string;
  liveURLs: MatchedURL[];
}

export interface URLCheckOptions {
  timeout: number;
  maxConcurrent: number;
  retries: number;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export interface ParsedOutput {
  h2: string;
  h3: string;
  paragraph1: string;
  paragraph2: string;
  metaTitle: string;
  metaDescription: string;
  internalLinks: InternalLink[];
  placementRecommendation: string;
}

// ── MongoDB / History types ───────────────────────────────────────────────

export interface GenerationRecord {
  id: string;
  provider: AIProvider;
  primaryKeyword: string;
  contentSnippet: string;
  urlCount: number;
  liveUrlCount: number;
  h2: string;
  h3: string;
  paragraph1: string;
  paragraph2: string;
  metaTitle: string;
  metaDescription: string;
  internalLinks: InternalLink[];
  placementRecommendation: string;
  tokensUsed?: number;
  durationMs: number;
  createdAt: string; // ISO date string
}

export interface ResultsResponse {
  success: boolean;
  data?: {
    results: GenerationRecord[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: string;
}
