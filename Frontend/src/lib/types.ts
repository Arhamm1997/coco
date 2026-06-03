export type AIProvider = 'claude' | 'openai' | 'gemini' | 'grok';

export interface ModelOption {
  id: string;
  label: string;
  tier?: string;
  rpmLimit?: number;
  rpdLimit?: number;
}

export interface ProviderInfo {
  id: AIProvider;
  name: string;
  company: string;
  model: string;
  models: ModelOption[];
  color: string;
  placeholder: string;
  emoji: string;
  rateLimitUrl?: string;
}

export interface InternalLink {
  anchorText: string;
  url: string;
  isLive: boolean;
}

export interface SEOResult {
  h2: string;
  h3: string;
  paragraph1: string;
  paragraph2: string;
  metaTitle: string;
  metaDescription: string;
  internalLinks: InternalLink[];
  placementRecommendation: string;
  tokensUsed?: number;
}

export interface LoadingStep {
  label: string;
  status: 'pending' | 'active' | 'done';
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'claude',
    name: 'Claude',
    company: 'Anthropic',
    model: 'claude-sonnet-4-6',
    models: [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', tier: 'Sonnet', rpmLimit: 50, rpdLimit: 1000 },
      { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', tier: 'Opus', rpmLimit: 5, rpdLimit: 100 },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', tier: 'Haiku', rpmLimit: 50, rpdLimit: 2000 },
    ],
    color: '#D4A0FF',
    placeholder: 'sk-ant-...',
    emoji: 'purple',
    rateLimitUrl: 'https://docs.anthropic.com/en/api/rate-limits',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    company: 'OpenAI',
    model: 'gpt-4o',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o', tier: 'Tier 1', rpmLimit: 500, rpdLimit: 10000 },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', tier: 'Tier 1', rpmLimit: 500, rpdLimit: 10000 },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', tier: 'Tier 1', rpmLimit: 500, rpdLimit: 10000 },
      { id: 'o3-mini', label: 'o3-mini', tier: 'Tier 1', rpmLimit: 500, rpdLimit: 10000 },
    ],
    color: '#00C896',
    placeholder: 'sk-...',
    emoji: 'green',
    rateLimitUrl: 'https://platform.openai.com/docs/guides/rate-limits',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    company: 'Google',
    model: 'gemini-2.0-flash',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', tier: 'Free', rpmLimit: 15, rpdLimit: 1500 },
      { id: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro', tier: 'Pay-as-you-go', rpmLimit: 5, rpdLimit: 25 },
      { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash', tier: 'Pay-as-you-go', rpmLimit: 10, rpdLimit: 500 },
    ],
    color: '#4285F4',
    placeholder: 'AIza...',
    emoji: 'blue',
    rateLimitUrl: 'https://ai.google.dev/gemini-api/docs/rate-limits',
  },
  {
    id: 'grok',
    name: 'Grok',
    company: 'xAI',
    model: 'grok-2',
    models: [
      { id: 'grok-2', label: 'Grok 2', tier: 'Standard', rpmLimit: 60, rpdLimit: 1440 },
      { id: 'grok-3', label: 'Grok 3', tier: 'Standard', rpmLimit: 60, rpdLimit: 1440 },
      { id: 'grok-3-mini', label: 'Grok 3 Mini', tier: 'Standard', rpmLimit: 60, rpdLimit: 1440 },
    ],
    color: '#8B8BAD',
    placeholder: 'xai-...',
    emoji: 'gray',
    rateLimitUrl: 'https://docs.x.ai/docs/rate-limits',
  },
];
