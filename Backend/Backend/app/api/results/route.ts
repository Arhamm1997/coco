import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { GenerationResult, IGenerationResult } from '@/lib/db/models/GenerationResult';
import { GenerationRecord, ResultsResponse } from '@/types';

/**
 * GET /api/results
 *
 * Query params:
 *   page      - page number (default: 1)
 *   pageSize  - results per page (default: 20, max: 100)
 *   provider  - filter by AI provider ('claude' | 'openai' | 'gemini' | 'grok')
 *   keyword   - partial match on primaryKeyword (case-insensitive)
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);

    const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1',  10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));
    const provider = searchParams.get('provider');
    const keyword  = searchParams.get('keyword');

    // Build dynamic filter
    const filter: Record<string, unknown> = {};
    if (provider && ['claude', 'openai', 'gemini', 'grok'].includes(provider)) {
      filter.provider = provider;
    }
    if (keyword && keyword.trim().length > 0) {
      filter.primaryKeyword = { $regex: keyword.trim(), $options: 'i' };
    }

    const [docs, total] = await Promise.all([
      GenerationResult.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<IGenerationResult[]>(),
      GenerationResult.countDocuments(filter),
    ]);

    const results: GenerationRecord[] = docs.map((doc) => ({
      id:                      String(doc._id),
      provider:                doc.provider,
      primaryKeyword:          doc.primaryKeyword,
      contentSnippet:          doc.contentSnippet,
      urlCount:                doc.urlCount,
      liveUrlCount:            doc.liveUrlCount,
      h2:                      doc.h2,
      h3:                      doc.h3,
      paragraph1:              doc.paragraph1,
      paragraph2:              doc.paragraph2,
      metaTitle:               doc.metaTitle,
      metaDescription:         doc.metaDescription,
      internalLinks:           doc.internalLinks,
      placementRecommendation: doc.placementRecommendation,
      tokensUsed:              doc.tokensUsed,
      durationMs:              doc.durationMs,
      createdAt:               doc.createdAt.toISOString(),
    }));

    const response: ResultsResponse = {
      success: true,
      data: { results, total, page, pageSize },
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error('[/api/results] GET error:', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch results';
    return NextResponse.json(
      { success: false, error: message } satisfies ResultsResponse,
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/results?id=<mongoId>
 * Deletes a single generation record by its MongoDB _id.
 */
export async function DELETE(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Query param "id" is required' },
        { status: 400 }
      );
    }

    const deleted = await GenerationResult.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    console.error('[/api/results] DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Failed to delete record';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
