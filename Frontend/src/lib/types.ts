export type AIProvider = 'claude' | 'openai' | 'gemini' | 'grok';

export interface ModelOption {
  id: string;
  label: string;
}

export interface ProviderInfo {
  id: AIProvider;
  name: string;
  company: string;
  model: string;          // default model id
  models: ModelOption[];   // all available models for this provider
  color: string;
  placeholder: string;
  emoji: string;
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
    model: 'claude-sonnet-4-5-20250514',
    models: [
      { id: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
      { id: 'claude-haiku-3-5-20241022', label: 'Claude Haiku 3.5' },
    ],
    color: '#D4A0FF',
    placeholder: 'sk-ant-...',
    emoji: 'purple',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    company: 'OpenAI',
    model: 'gpt-4o',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { id: 'o3-mini', label: 'o3-mini' },
    ],
    color: '#00C896',
    placeholder: 'sk-...',
    emoji: 'green',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    company: 'Google',
    model: 'gemini-2.0-flash',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash' },
    ],
    color: '#4285F4',
    placeholder: 'AIza...',
    emoji: 'blue',
  },
  {
    id: 'grok',
    name: 'Grok',
    company: 'xAI',
    model: 'grok-2',
    models: [
      { id: 'grok-2', label: 'Grok 2' },
      { id: 'grok-3', label: 'Grok 3' },
      { id: 'grok-3-mini', label: 'Grok 3 Mini' },
    ],
    color: '#8B8BAD',
    placeholder: 'xai-...',
    emoji: 'gray',
  },
];
