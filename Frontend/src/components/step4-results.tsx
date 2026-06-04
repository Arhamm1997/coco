import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  AlignLeft,
  Search,
  Link,
  MapPin,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Eye,
  EyeOff,
  FileCode,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { SEOResult, AIProvider, PROVIDERS } from '../lib/types';
import { formatResultsAsMarkdown, formatResultsAsHTML } from '../lib/api';
import { SerpPreview } from './serp-preview';

interface Step4Props {
  results: SEOResult;
  provider: AIProvider;
  keyword: string;
  onStartOver: () => void;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <motion.button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all cursor-pointer"
      style={{
        background: copied ? 'rgba(0, 200, 150, 0.1)' : 'rgba(255, 255, 255, 0.03)',
        border: `1px solid ${copied ? 'rgba(0, 200, 150, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
        color: copied ? '#00C896' : '#8B8BAD',
      }}
      whileHover={{ background: 'rgba(255, 255, 255, 0.06)' }}
      whileTap={{ scale: 0.95 }}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {label || 'Copy'}
    </motion.button>
  );
}

function HighlightKeyword({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword) return <>{text}</>;

  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="keyword-highlight">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function CharBadge({ count, max }: { count: number; max: number }) {
  const isOver = count > max;
  const isNear = count > max * 0.9;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs"
      style={{
        background: isOver
          ? 'rgba(255, 71, 87, 0.1)'
          : isNear
          ? 'rgba(255, 184, 0, 0.1)'
          : 'rgba(0, 200, 150, 0.1)',
        color: isOver ? '#FF4757' : isNear ? '#FFB800' : '#00C896',
        border: `1px solid ${isOver ? 'rgba(255, 71, 87, 0.2)' : isNear ? 'rgba(255, 184, 0, 0.2)' : 'rgba(0, 200, 150, 0.2)'}`,
        fontWeight: 500,
      }}
    >
      {count}/{max}
      {isOver && ` (−${count - max})`}
    </span>
  );
}

function WordCountBadge({ text }: { text: string }) {
  const count = text.trim().split(/\s+/).filter(Boolean).length;
  const inRange = count >= 70 && count <= 90;
  const close = count >= 60 && count < 70;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs"
      style={{
        background: inRange
          ? 'rgba(0, 200, 150, 0.1)'
          : close
          ? 'rgba(255, 184, 0, 0.1)'
          : 'rgba(255, 71, 87, 0.1)',
        color: inRange ? '#00C896' : close ? '#FFB800' : '#FF4757',
        border: `1px solid ${inRange ? 'rgba(0, 200, 150, 0.2)' : close ? 'rgba(255, 184, 0, 0.2)' : 'rgba(255, 71, 87, 0.2)'}`,
        fontWeight: 500,
      }}
    >
      {count}w {inRange ? '✓' : count < 70 ? '(too short)' : '(too long)'}
    </span>
  );
}

function VerificationPanel({ results, keyword }: { results: SEOResult; keyword: string }) {
  const kw = keyword.toLowerCase();
  const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
  const hasEmDash = (t: string) => t.includes('—') || t.includes('—');
  const allText = [
    results.h2,
    results.paragraph1,
    results.h3,
    results.paragraph2,
    results.metaTitle,
    results.metaDescription,
  ].join(' ');

  const p1Words = wordCount(results.paragraph1);
  const p2Words = wordCount(results.paragraph2);

  const checks = [
    { label: 'Keyword in H2',       pass: results.h2.toLowerCase().includes(kw) },
    { label: 'Keyword in meta desc', pass: results.metaDescription.toLowerCase().includes(kw) },
    { label: 'Meta title ≤55',       pass: results.metaTitle.length <= 55 },
    { label: 'Meta desc ≤145',       pass: results.metaDescription.length <= 145 },
    { label: 'P1 70–90 words',       pass: p1Words >= 70 && p1Words <= 90 },
    { label: 'P2 70–90 words',       pass: p2Words >= 70 && p2Words <= 90 },
    { label: '3 links found',        pass: results.internalLinks.length === 3 },
    { label: 'No em dashes',         pass: !hasEmDash(allText) },
  ];

  const passCount = checks.filter((c) => c.pass).length;
  const allPassed = passCount === checks.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 mb-4"
      style={{
        background: allPassed ? 'rgba(0, 200, 150, 0.04)' : 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${allPassed ? 'rgba(0, 200, 150, 0.15)' : 'rgba(255, 255, 255, 0.06)'}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck
            className="w-4 h-4"
            style={{ color: allPassed ? '#00C896' : '#8B8BAD' }}
          />
          <span className="text-xs font-semibold" style={{ color: '#8B8BAD', letterSpacing: '0.05em' }}>
            QUALITY CHECKS
          </span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            background: allPassed ? 'rgba(0, 200, 150, 0.12)' : 'rgba(255, 184, 0, 0.12)',
            color: allPassed ? '#00C896' : '#FFB800',
          }}
        >
          {passCount}/{checks.length} passed
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {checks.map((check) => (
          <span
            key={check.label}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs"
            style={{
              background: check.pass ? 'rgba(0, 200, 150, 0.08)' : 'rgba(255, 71, 87, 0.08)',
              color: check.pass ? '#00C896' : '#FF4757',
              border: `1px solid ${check.pass ? 'rgba(0, 200, 150, 0.15)' : 'rgba(255, 71, 87, 0.15)'}`,
              fontWeight: 500,
            }}
          >
            {check.pass ? '✓' : '✗'} {check.label}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

const containerVariants = {
  animate: { transition: { staggerChildren: 0.12 } },
};

const cardVariants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export function Step4Results({ results, provider, keyword, onStartOver }: Step4Props) {
  const providerInfo = PROVIDERS.find((p) => p.id === provider);
  const [showPreview, setShowPreview] = useState(false);

  const timestamp = useMemo(() => {
    return new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const handleCopyAll = async () => {
    try {
      const markdown = formatResultsAsMarkdown(results);
      await navigator.clipboard.writeText(markdown);
      toast.success('Full output copied to clipboard!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleCopyHTML = async () => {
    try {
      const html = formatResultsAsHTML(results);
      await navigator.clipboard.writeText(html);
      toast.success('Copied as HTML!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const contentBlockText = `## ${results.h2}\n\n${results.paragraph1}\n\n### ${results.h3}\n\n${results.paragraph2}`;

  return (
    <motion.div variants={containerVariants} initial="initial" animate="animate">
      {/* Header */}
      <motion.div
        variants={cardVariants}
        className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h2
            className="flex items-center gap-2 gradient-text"
            style={{ fontSize: '1.5rem', fontWeight: 700 }}
          >
            <Sparkles className="w-6 h-6" style={{ color: '#6C63FF' }} />
            SEO Content Ready!
          </h2>
          <p className="text-xs mt-1" style={{ color: '#8B8BAD' }}>
            Generated by {providerInfo?.name} &middot; {timestamp}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <motion.button
            onClick={handleCopyHTML}
            className="px-3 py-2 rounded-xl flex items-center gap-2 text-xs cursor-pointer transition-all"
            style={{
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              color: '#00D4FF',
              fontWeight: 600,
            }}
            whileHover={{ background: 'rgba(0, 212, 255, 0.14)' }}
            whileTap={{ scale: 0.97 }}
          >
            <FileCode className="w-3.5 h-3.5" />
            Copy HTML
          </motion.button>
          <motion.button
            onClick={handleCopyAll}
            className="px-4 py-2 rounded-xl flex items-center gap-2 text-xs cursor-pointer transition-all"
            style={{
              background: 'linear-gradient(135deg, #6C63FF, #00D4FF)',
              color: 'white',
              fontWeight: 600,
            }}
            whileHover={{ y: -1, boxShadow: '0 4px 15px rgba(108,99,255,0.3)' }}
            whileTap={{ scale: 0.97 }}
          >
            <Copy className="w-3.5 h-3.5" />
            Copy All
          </motion.button>
          <motion.button
            onClick={onStartOver}
            className="px-4 py-2 rounded-xl flex items-center gap-2 text-xs cursor-pointer transition-all"
            style={{
              background: 'transparent',
              border: '1px solid #2A2A3E',
              color: '#8B8BAD',
              fontWeight: 500,
            }}
            whileHover={{ borderColor: '#4A4A6A' }}
            whileTap={{ scale: 0.97 }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Start Over
          </motion.button>
        </div>
      </motion.div>

      {/* Quality Checks Panel */}
      <VerificationPanel results={results} keyword={keyword} />

      {/* Card 1 — Content Block */}
      <motion.div
        variants={cardVariants}
        className="rounded-2xl p-6 mb-4 relative overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(0, 200, 150, 0.12)' }}
            >
              <AlignLeft className="w-4 h-4" style={{ color: '#00C896' }} />
            </div>
            <span style={{ color: '#F0F0FF', fontSize: '0.9375rem', fontWeight: 600 }}>
              Content Block
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ background: 'rgba(0, 200, 150, 0.1)', color: '#00C896', fontWeight: 500 }}
            >
              Ready
            </span>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs cursor-pointer"
              style={{
                background: showPreview ? 'rgba(108, 99, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${showPreview ? 'rgba(108, 99, 255, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                color: showPreview ? '#6C63FF' : '#8B8BAD',
                fontWeight: 500,
              }}
              whileTap={{ scale: 0.95 }}
            >
              {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showPreview ? 'Editor' : 'Preview'}
            </motion.button>
            <CopyButton text={contentBlockText} label="Copy All" />
          </div>
        </div>

        {showPreview ? (
          /* Article preview — rendered as real typography */
          <div
            className="rounded-xl p-6"
            style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
          >
            <h2
              style={{
                fontSize: '1.375rem',
                fontWeight: 700,
                color: '#111827',
                lineHeight: '1.4',
                marginBottom: '1rem',
                fontFamily: 'Georgia, serif',
              }}
            >
              {results.h2}
            </h2>
            <p
              style={{
                fontSize: '1rem',
                lineHeight: '1.85',
                color: '#374151',
                marginBottom: '1.5rem',
                fontFamily: 'Georgia, serif',
              }}
            >
              {results.paragraph1}
            </p>
            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: '#1F2937',
                lineHeight: '1.4',
                marginBottom: '0.75rem',
                fontFamily: 'Georgia, serif',
              }}
            >
              {results.h3}
            </h3>
            <p
              style={{
                fontSize: '1rem',
                lineHeight: '1.85',
                color: '#374151',
                fontFamily: 'Georgia, serif',
              }}
            >
              {results.paragraph2}
            </p>
          </div>
        ) : (
          /* Editor view — labelled sections with copy buttons */
          <div
            className="rounded-xl p-5 space-y-4"
            style={{
              background: 'rgba(10, 10, 15, 0.5)',
              border: '1px solid rgba(42, 42, 62, 0.5)',
            }}
          >
            {/* H2 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: '#8B8BAD', fontWeight: 500 }}>
                  H2 Heading
                </span>
                <CopyButton text={results.h2} label="Copy H2" />
              </div>
              <h2 className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {results.h2}
              </h2>
              <div
                className="w-full h-px mt-3"
                style={{ background: 'linear-gradient(90deg, #6C63FF40, transparent)' }}
              />
            </div>

            {/* P1 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: '#8B8BAD', fontWeight: 500 }}>
                    Paragraph 1
                  </span>
                  <WordCountBadge text={results.paragraph1} />
                </div>
                <CopyButton text={results.paragraph1} label="Copy P1" />
              </div>
              <p style={{ color: '#C8C8E0', lineHeight: '1.8', fontSize: '0.875rem' }}>
                {results.paragraph1}
              </p>
            </div>

            {/* H3 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: '#8B8BAD', fontWeight: 500 }}>
                  H3 Subheading
                </span>
                <CopyButton text={results.h3} label="Copy H3" />
              </div>
              <h3 className="gradient-text-pink" style={{ fontSize: '1.0625rem', fontWeight: 600 }}>
                {results.h3}
              </h3>
              <div
                className="w-full h-px mt-3"
                style={{ background: 'linear-gradient(90deg, #FF6B9540, transparent)' }}
              />
            </div>

            {/* P2 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: '#8B8BAD', fontWeight: 500 }}>
                    Paragraph 2
                  </span>
                  <WordCountBadge text={results.paragraph2} />
                </div>
                <CopyButton text={results.paragraph2} label="Copy P2" />
              </div>
              <p style={{ color: '#C8C8E0', lineHeight: '1.8', fontSize: '0.875rem' }}>
                {results.paragraph2}
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Card 2 — Meta Data */}
      <motion.div
        variants={cardVariants}
        className="rounded-2xl p-6 mb-4 relative overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(108, 99, 255, 0.12)' }}
          >
            <Search className="w-4 h-4" style={{ color: '#6C63FF' }} />
          </div>
          <span style={{ color: '#F0F0FF', fontSize: '0.9375rem', fontWeight: 600 }}>
            Meta Data
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Meta Title */}
          <div
            className="rounded-xl p-4"
            style={{
              background: 'rgba(10, 10, 15, 0.5)',
              border: '1px solid rgba(42, 42, 62, 0.5)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs" style={{ color: '#8B8BAD', fontWeight: 500 }}>
                Meta Title
              </span>
              <div className="flex items-center gap-2">
                <CharBadge count={results.metaTitle.length} max={55} />
                <CopyButton text={results.metaTitle} />
              </div>
            </div>
            <p style={{ color: '#F0F0FF', fontSize: '1rem', fontWeight: 500, lineHeight: '1.5' }}>
              <HighlightKeyword text={results.metaTitle} keyword={keyword} />
            </p>
          </div>

          {/* Meta Description */}
          <div
            className="rounded-xl p-4"
            style={{
              background: 'rgba(10, 10, 15, 0.5)',
              border: '1px solid rgba(42, 42, 62, 0.5)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs" style={{ color: '#8B8BAD', fontWeight: 500 }}>
                Meta Description
              </span>
              <div className="flex items-center gap-2">
                <CharBadge count={results.metaDescription.length} max={145} />
                <CopyButton text={results.metaDescription} />
              </div>
            </div>
            <p style={{ color: '#C8C8E0', fontSize: '0.875rem', lineHeight: '1.7' }}>
              <HighlightKeyword text={results.metaDescription} keyword={keyword} />
            </p>
          </div>
        </div>

        {/* SERP Preview */}
        <SerpPreview title={results.metaTitle} description={results.metaDescription} />
      </motion.div>

      {/* Card 3 — Internal Links */}
      <motion.div
        variants={cardVariants}
        className="rounded-2xl p-6 mb-4 relative overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(0, 212, 255, 0.12)' }}
            >
              <Link className="w-4 h-4" style={{ color: '#00D4FF' }} />
            </div>
            <span style={{ color: '#F0F0FF', fontSize: '0.9375rem', fontWeight: 600 }}>
              Internal Links
            </span>
          </div>
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{
              background:
                results.internalLinks.length === 3
                  ? 'rgba(0, 200, 150, 0.1)'
                  : 'rgba(255, 71, 87, 0.1)',
              color: results.internalLinks.length === 3 ? '#00C896' : '#FF4757',
              fontWeight: 500,
            }}
          >
            {results.internalLinks.length}/3 found
          </span>
        </div>

        <div className="space-y-3">
          {results.internalLinks.map((link, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl p-4"
              style={{
                background: 'rgba(10, 10, 15, 0.5)',
                border: '1px solid rgba(42, 42, 62, 0.5)',
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0"
                  style={{
                    background: 'rgba(108, 99, 255, 0.1)',
                    color: '#6C63FF',
                    fontWeight: 600,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        background: link.isLive
                          ? 'rgba(0, 200, 150, 0.1)'
                          : 'rgba(255, 184, 0, 0.1)',
                        color: link.isLive ? '#00C896' : '#FFB800',
                        fontWeight: 500,
                      }}
                    >
                      {link.isLive ? 'LIVE' : 'UNVERIFIED'}
                    </span>
                  </div>
                  <p className="mb-1">
                    <span className="text-xs" style={{ color: '#8B8BAD' }}>
                      Anchor:{' '}
                    </span>
                    <span
                      style={{ color: '#F0F0FF', fontStyle: 'italic', fontSize: '0.875rem' }}
                    >
                      &ldquo;{link.anchorText}&rdquo;
                    </span>
                  </p>
                  <p className="truncate mb-3" title={link.url}>
                    <span className="text-xs" style={{ color: '#8B8BAD' }}>
                      URL:{' '}
                    </span>
                    <span className="text-xs" style={{ color: '#00D4FF' }}>
                      {link.url}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <CopyButton text={link.anchorText} label="Copy Anchor" />
                    <CopyButton text={link.url} label="Copy URL" />
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all"
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        color: '#8B8BAD',
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {results.internalLinks.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: '#8B8BAD' }}>
              No verified internal links were found. Try uploading more URLs.
            </p>
          )}
        </div>
      </motion.div>

      {/* Card 4 — Placement Recommendation */}
      <motion.div
        variants={cardVariants}
        className="rounded-2xl p-6 mb-8 relative overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255, 184, 0, 0.12)' }}
          >
            <MapPin className="w-4 h-4" style={{ color: '#FFB800' }} />
          </div>
          <span style={{ color: '#F0F0FF', fontSize: '0.9375rem', fontWeight: 600 }}>
            Placement Recommendation
          </span>
          <span
            className="px-2 py-0.5 rounded text-xs"
            style={{
              background: 'rgba(255, 184, 0, 0.1)',
              color: '#FFB800',
              fontWeight: 500,
            }}
          >
            Tip
          </span>
        </div>

        <div
          className="rounded-xl p-4 relative"
          style={{ background: 'rgba(255, 184, 0, 0.03)', borderLeft: '3px solid #FFB800' }}
        >
          <p style={{ color: '#C8C8E0', fontStyle: 'italic', lineHeight: '1.7', fontSize: '0.875rem' }}>
            {results.placementRecommendation}
          </p>
        </div>

        <div className="mt-3 flex justify-end">
          <CopyButton text={results.placementRecommendation} label="Copy Note" />
        </div>
      </motion.div>

      {/* Bottom Actions */}
      <motion.div variants={cardVariants} className="flex flex-col sm:flex-row gap-3">
        <motion.button
          onClick={onStartOver}
          className="flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
          style={{
            background: 'transparent',
            border: '1px solid #2A2A3E',
            color: '#8B8BAD',
            fontSize: '0.9375rem',
            fontWeight: 500,
          }}
          whileHover={{ borderColor: '#4A4A6A' }}
          whileTap={{ scale: 0.98 }}
        >
          <RotateCcw className="w-4 h-4" />
          Start Over
        </motion.button>
        <motion.button
          onClick={handleCopyAll}
          className="flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 text-white transition-all cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #6C63FF, #00D4FF)',
            fontSize: '0.9375rem',
            fontWeight: 600,
          }}
          whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(108, 99, 255, 0.35)' }}
          whileTap={{ scale: 0.98 }}
        >
          <Copy className="w-4 h-4" />
          Copy Full Output
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
