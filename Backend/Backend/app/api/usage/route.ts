import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { GenerationResult } from '@/lib/db/models/GenerationResult';
import { AIProvider, ProviderUsageStat, ModelUsageStat, UsageStatsResponse } from '@/types';

/**
 * GET /api/usage
 *
 * Returns aggregated usage statistics grouped by provider and model.
 * Includes total requests and total tokens consumed per provider/model.
 */
export async function GET() {
  try {
    await connectDB();

    // Aggregate: group by provider + model, sum requests and tokens
    const agg = await GenerationResult.aggregate([
      {
        $group: {
          _id: {
            provider: '$provider',
            model: { $ifNull: ['$modelId', 'unknown'] },
          },
          requests: { $sum: 1 },
          totalTokens: { $sum: { $ifNull: ['$tokensUsed', 0] } },
        },
      },
      {
        $sort: { '_id.provider': 1, '_id.model': 1 },
      },
    ]);

    // Structure into per-provider groups
    const providerMap = new Map<AIProvider, ProviderUsageStat>();

    for (const row of agg) {
      const providerKey = row._id.provider as AIProvider;
      const modelKey    = row._id.model as string;

      if (!providerMap.has(providerKey)) {
        providerMap.set(providerKey, {
          provider:    providerKey,
          requests:    0,
          totalTokens: 0,
          models:      [],
        });
      }

      const providerStat = providerMap.get(providerKey)!;
      providerStat.requests    += row.requests;
      providerStat.totalTokens += row.totalTokens;

      const modelStat: ModelUsageStat = {
        model:       modelKey,
        requests:    row.requests,
        totalTokens: row.totalTokens,
      };
      providerStat.models.push(modelStat);
    }

    const providers = Array.from(providerMap.values());
    const totalRequests = providers.reduce((s, p) => s + p.requests, 0);
    const totalTokens   = providers.reduce((s, p) => s + p.totalTokens, 0);

    const response: UsageStatsResponse = {
      success: true,
      data: { providers, totalRequests, totalTokens },
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error('[/api/usage] GET error:', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch usage stats';
    return NextResponse.json(
      { success: false, error: message } satisfies UsageStatsResponse,
      { status: 500 }
    );
  }
}
