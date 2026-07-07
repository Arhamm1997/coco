import mongoose, { Schema, Document, Model } from 'mongoose';
import { AIProvider } from '@/types';

// ── Sub-document schema for internal links ─────────────────────────────────
const InternalLinkSchema = new Schema(
  {
    anchorText: { type: String, required: true },
    url:        { type: String, required: true },
    isLive:     { type: Boolean, required: true, default: true },
  },
  { _id: false }
);

// ── Main document interface ────────────────────────────────────────────────
export interface IGenerationResult extends Document {
  // Input context (stored for history & analytics)
  provider:       AIProvider;
  primaryKeyword: string;
  contentSnippet: string;   // First 300 chars of the original content
  urlCount:       number;   // How many URLs were in the spreadsheet
  liveUrlCount:   number;   // How many passed the HEAD-check

  // Generated output
  h2:                     string;
  h3:                     string;
  paragraph1:             string;
  paragraph2:             string;
  metaTitle:              string;
  metaDescription:        string;
  internalLinks:          Array<{ anchorText: string; url: string; isLive: boolean }>;
  placementRecommendation: string;

  // Metadata
  tokensUsed?: number;
  durationMs:  number;   // Total server processing time in ms
  createdAt:   Date;
}

// ── Schema definition ──────────────────────────────────────────────────────
const GenerationResultSchema = new Schema<IGenerationResult>(
  {
    provider:       { type: String, required: true, enum: ['claude', 'openai', 'gemini', 'grok'] },
    primaryKeyword: { type: String, required: true, trim: true },
    contentSnippet: { type: String, required: true },
    urlCount:       { type: Number, required: true, min: 0 },
    liveUrlCount:   { type: Number, required: true, min: 0 },

    h2:                     { type: String, required: true },
    h3:                     { type: String, required: true },
    paragraph1:             { type: String, required: true },
    paragraph2:             { type: String, required: true },
    metaTitle:              { type: String, required: true, maxlength: 55 },
    metaDescription:        { type: String, required: true, maxlength: 145 },
    internalLinks:          { type: [InternalLinkSchema], default: [] },
    placementRecommendation: { type: String, required: true },

    tokensUsed: { type: Number },
    durationMs: { type: Number, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'generation_results',
  }
);

// ── Indexes for common query patterns ─────────────────────────────────────
GenerationResultSchema.index({ createdAt: -1 });          // Latest first
GenerationResultSchema.index({ provider: 1, createdAt: -1 }); // Filter by provider
GenerationResultSchema.index({ primaryKeyword: 'text' }); // Full-text search on keyword

// ── Model (handle Next.js hot-reload re-registration) ─────────────────────
export const GenerationResult: Model<IGenerationResult> =
  (mongoose.models.GenerationResult as Model<IGenerationResult>) ??
  mongoose.model<IGenerationResult>('GenerationResult', GenerationResultSchema);
