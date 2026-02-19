import { OptimizeRequest, ValidationResult } from '@/types';

const VALID_PROVIDERS = ['claude', 'openai', 'gemini', 'grok'] as const;

export function validateOptimizeRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, message: 'Request body is required' };
  }

  const req = body as Partial<OptimizeRequest>;

  if (!req.content || typeof req.content !== 'string' || req.content.trim().length < 100) {
    return { valid: false, message: 'Content must be at least 100 characters' };
  }

  const wordCount = req.content.trim().split(/\s+/).length;
  if (wordCount < 50) {
    return { valid: false, message: 'Content must have at least 50 words' };
  }

  if (!req.primaryKeyword || typeof req.primaryKeyword !== 'string' || req.primaryKeyword.trim().length < 2) {
    return { valid: false, message: 'Primary keyword must be at least 2 characters' };
  }

  if (!Array.isArray(req.urls) || req.urls.length === 0) {
    return { valid: false, message: 'At least one URL is required from the spreadsheet' };
  }

  if (req.urls.some((u) => typeof u !== 'string' || !u.startsWith('http'))) {
    return { valid: false, message: 'All URLs must be valid strings starting with http' };
  }

  if (!req.apiKey || typeof req.apiKey !== 'string' || req.apiKey.trim().length < 10) {
    return { valid: false, message: 'A valid API key is required (minimum 10 characters)' };
  }

  if (!req.provider || !(VALID_PROVIDERS as readonly string[]).includes(req.provider)) {
    return { valid: false, message: `Provider must be one of: ${VALID_PROVIDERS.join(', ')}` };
  }

  return { valid: true };
}
