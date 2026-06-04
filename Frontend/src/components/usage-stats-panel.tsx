import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart2,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  Activity,
} from 'lucide-react';
import { AIProvider, PROVIDERS } from '../lib/types';
import { UsageStats } from '../lib/api';
import { SessionUsage } from '../App';

interface UsageStatsPanelProps {
  sessionUsage: SessionUsage[];
  globalStats: UsageStats | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

const providerColors: Record<AIProvider, string> = {
  claude: '#D4A0FF',
  openai: '#00C896',
  gemini: '#4285F4',
  grok: '#8B8BAD',
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getModelInfo(modelId: string) {
  for (const p of PROVIDERS) {
    const found = p.models.find((m) => m.id === modelId);
    if (found) return { model: found, provider: p };
  }
  return null;
}

function RateLimitBar({
  used,
  limit,
  label,
  color,
}: {
  used: number;
  limit: number;
  label: string;
  color: string;
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const remaining = Math.max(0, limit - used);
  const barColor = pct >= 90 ? '#FF4757' : pct >= 70 ? '#FFB800' : color;

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs" style={{ color: '#8B8BAD' }}>{label}</span>
        <span className="text-xs font-mono" style={{ color: '#F0F0FF' }}>
          <span style={{ color: barColor }}>{remaining}</span>
          <span style={{ color: '#4A4A6A' }}> / {limit} left</span>
        </span>
      </div>
      <div
        className="w-full h-1.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export function UsageStatsPanel({
  sessionUsage,
  globalStats,
  onRefresh,
  isRefreshing = false,
}: UsageStatsPanelProps) {
  const [expandedProvider, setExpandedProvider] = useState<AIProvider | null>(null);
  const [showSession, setShowSession] = useState(false);

  const sessionTokens = sessionUsage.reduce((s, u) => s + u.tokensUsed, 0);
  const sessionRequests = sessionUsage.length;

  return (
    <div
      className="rounded-2xl p-6 sm:p-8 relative overflow-hidden mb-6"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Green left border glow */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ background: 'linear-gradient(180deg, #00C896, #00C89680)' }}
      />
      <div
        className="absolute left-0 top-0 bottom-0 w-8"
        style={{ background: 'linear-gradient(90deg, rgba(0,200,150,0.06), transparent)' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(0, 200, 150, 0.15)' }}
          >
            <BarChart2 className="w-5 h-5" style={{ color: '#00C896' }} />
          </div>
          <div>
            <h2 className="text-[#F0F0FF]" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              API Usage &amp; Rate Limits
            </h2>
            <p className="text-xs" style={{ color: '#8B8BAD' }}>
              Tokens consumed &amp; approximate request limits per model
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg transition-colors hover:bg-white/5 cursor-pointer"
          style={{ color: '#8B8BAD' }}
          title="Refresh stats"
        >
          <RefreshCw className={`w-4 h-4${isRefreshing ? ' animate-spin' : ''}`} />
        </button>
      </div>

      {/* Session summary (only shown if there are generations this session) */}
      {sessionRequests > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 mb-5 cursor-pointer"
          style={{
            background: 'rgba(108, 99, 255, 0.08)',
            border: '1px solid rgba(108, 99, 255, 0.2)',
          }}
          onClick={() => setShowSession(!showSession)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: '#6C63FF' }} />
              <span className="text-sm font-medium" style={{ color: '#6C63FF' }}>
                This Session
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs" style={{ color: '#8B8BAD' }}>Requests</div>
                <div className="text-sm font-mono font-semibold" style={{ color: '#F0F0FF' }}>
                  {sessionRequests}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs" style={{ color: '#8B8BAD' }}>Tokens used</div>
                <div className="text-sm font-mono font-semibold" style={{ color: '#F0F0FF' }}>
                  {formatTokens(sessionTokens)}
                </div>
              </div>
              {showSession
                ? <ChevronUp className="w-4 h-4" style={{ color: '#4A4A6A' }} />
                : <ChevronDown className="w-4 h-4" style={{ color: '#4A4A6A' }} />}
            </div>
          </div>

          <AnimatePresence>
            {showSession && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div
                  className="mt-3 pt-3 space-y-2"
                  style={{ borderTop: '1px solid rgba(108,99,255,0.2)' }}
                >
                  {sessionUsage.map((u, i) => {
                    const info = getModelInfo(u.model);
                    const pColor = providerColors[u.provider] ?? '#6C63FF';
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs rounded-lg px-3 py-2"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: pColor }}
                          />
                          <span style={{ color: '#F0F0FF' }}>
                            {info?.model.label ?? u.model}
                          </span>
                          <span
                            className="px-1.5 py-0.5 rounded"
                            style={{ background: `${pColor}18`, color: pColor, fontSize: '0.65rem' }}
                          >
                            {u.provider.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono" style={{ color: '#8B8BAD' }}>
                            {formatTokens(u.tokensUsed)} tokens
                          </span>
                          <span style={{ color: '#4A4A6A' }}>
                            <Clock className="w-3 h-3 inline mr-1" />
                            {new Date(u.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Global stats from MongoDB */}
      {globalStats && globalStats.totalRequests > 0 ? (
        <div className="space-y-3 mb-5">
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: '#4A4A6A' }}
            >
              All-time (from history)
            </span>
            <span className="text-xs" style={{ color: '#8B8BAD' }}>
              {globalStats.totalRequests} requests &middot;{' '}
              {formatTokens(globalStats.totalTokens)} tokens
            </span>
          </div>

          {globalStats.providers.map((ps) => {
            const providerInfo = PROVIDERS.find((p) => p.id === ps.provider);
            const pColor = providerColors[ps.provider] ?? '#6C63FF';
            const isExpanded = expandedProvider === ps.provider;

            return (
              <motion.div
                key={ps.provider}
                className="rounded-xl overflow-hidden"
                style={{
                  border: `1px solid ${isExpanded ? `${pColor}40` : 'rgba(255,255,255,0.06)'}`,
                  background: isExpanded ? `${pColor}08` : 'rgba(255,255,255,0.02)',
                }}
              >
                <button
                  onClick={() =>
                    setExpandedProvider(isExpanded ? null : ps.provider)
                  }
                  className="w-full flex items-center justify-between p-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: pColor }}
                    />
                    <div className="text-left">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: '#F0F0FF' }}
                      >
                        {providerInfo?.name ?? ps.provider}
                      </span>
                      <span className="text-xs ml-2" style={{ color: '#4A4A6A' }}>
                        {providerInfo?.company}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs" style={{ color: '#8B8BAD' }}>Requests</div>
                      <div
                        className="text-sm font-mono font-semibold"
                        style={{ color: pColor }}
                      >
                        {ps.requests}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs" style={{ color: '#8B8BAD' }}>Tokens</div>
                      <div
                        className="text-sm font-mono font-semibold"
                        style={{ color: '#F0F0FF' }}
                      >
                        {formatTokens(ps.totalTokens)}
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: '#4A4A6A' }} />
                      : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: '#4A4A6A' }} />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="px-4 pb-4 space-y-4"
                        style={{ borderTop: `1px solid ${pColor}20` }}
                      >
                        {ps.models.map((ms) => {
                          const modelInfo = providerInfo?.models.find(
                            (m) => m.id === ms.model
                          );
                          return (
                            <div key={ms.model} className="pt-4">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <span
                                    className="text-sm font-medium"
                                    style={{ color: '#F0F0FF' }}
                                  >
                                    {modelInfo?.label ?? ms.model}
                                  </span>
                                  {modelInfo?.tier && (
                                    <span
                                      className="ml-2 text-xs px-2 py-0.5 rounded-full"
                                      style={{
                                        background: `${pColor}15`,
                                        color: pColor,
                                      }}
                                    >
                                      {modelInfo.tier}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-3">
                                  <div className="text-right">
                                    <div className="text-xs" style={{ color: '#8B8BAD' }}>
                                      Requests
                                    </div>
                                    <div
                                      className="text-sm font-mono"
                                      style={{ color: pColor }}
                                    >
                                      {ms.requests}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs" style={{ color: '#8B8BAD' }}>
                                      Tokens
                                    </div>
                                    <div
                                      className="text-sm font-mono"
                                      style={{ color: '#F0F0FF' }}
                                    >
                                      {formatTokens(ms.totalTokens)}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {modelInfo?.rpmLimit !== undefined && (
                                <div className="space-y-2">
                                  <RateLimitBar
                                    used={ms.requests}
                                    limit={modelInfo.rpmLimit}
                                    label="RPM (requests/min limit)"
                                    color={pColor}
                                  />
                                  {modelInfo.rpdLimit !== undefined && (
                                    <RateLimitBar
                                      used={ms.requests}
                                      limit={modelInfo.rpdLimit}
                                      label="RPD (requests/day limit)"
                                      color={pColor}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {providerInfo?.rateLimitUrl && (
                          <div className="pt-2">
                            <a
                              href={providerInfo.rateLimitUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs hover:underline"
                              style={{ color: pColor }}
                            >
                              <ExternalLink className="w-3 h-3" />
                              View official rate limits
                            </a>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      ) : globalStats && globalStats.totalRequests === 0 ? (
        <div
          className="rounded-xl p-6 flex flex-col items-center justify-center mb-5"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Zap className="w-8 h-8 mb-2" style={{ color: '#4A4A6A' }} />
          <p className="text-sm" style={{ color: '#8B8BAD' }}>No generation history yet</p>
          <p className="text-xs mt-1" style={{ color: '#4A4A6A' }}>
            Usage stats appear after your first generation
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl p-6 flex flex-col items-center justify-center mb-5"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Activity className="w-8 h-8 mb-2" style={{ color: '#4A4A6A' }} />
          <p className="text-sm" style={{ color: '#8B8BAD' }}>Connect to database to see history</p>
          <p className="text-xs mt-1" style={{ color: '#4A4A6A' }}>
            Make sure your backend is running and MongoDB is connected
          </p>
        </div>
      )}

      {/* Legend */}
      <div
        className="rounded-xl p-3 flex items-center gap-4 flex-wrap"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <span className="text-xs" style={{ color: '#4A4A6A' }}>Rate limit bars:</span>
        {[
          { color: '#00C896', label: '< 70% used' },
          { color: '#FFB800', label: '70-90% used' },
          { color: '#FF4757', label: '> 90% used' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
            <span className="text-xs" style={{ color: '#8B8BAD' }}>{label}</span>
          </div>
        ))}
        <span className="text-xs ml-auto" style={{ color: '#4A4A6A' }}>
          * Limits are approximate. Check provider docs for exact values.
        </span>
      </div>
    </div>
  );
}
