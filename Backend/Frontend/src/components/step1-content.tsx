import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { FileText, Tag, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Step1Props {
  content: string;
  keyword: string;
  onContentChange: (v: string) => void;
  onKeywordChange: (v: string) => void;
  onNext: () => void;
}

export function Step1Content({ content, keyword, onContentChange, onKeywordChange, onNext }: Step1Props) {
  const [shakeKeyword, setShakeKeyword] = useState(false);

  const wordCount = useMemo(() => {
    const words = content.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [content]);

  const charCount = content.length;

  const handleNext = () => {
    if (wordCount < 50) {
      toast.warning('Content too short', {
        description: 'Please provide at least 50 words for meaningful SEO analysis.',
      });
      return;
    }
    if (!keyword.trim()) {
      setShakeKeyword(true);
      setTimeout(() => setShakeKeyword(false), 600);
      toast.error('Keyword required', {
        description: 'Please enter a primary keyword.',
      });
      return;
    }
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div
        className="rounded-2xl p-6 sm:p-8 relative overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Purple left border glow */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
          style={{ background: 'linear-gradient(180deg, #6C63FF, #6C63FF80)' }}
        />
        <div
          className="absolute left-0 top-0 bottom-0 w-8"
          style={{ background: 'linear-gradient(90deg, rgba(108,99,255,0.08), transparent)' }}
        />

        {/* Section Title */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(108, 99, 255, 0.15)' }}
          >
            <FileText className="w-5 h-5" style={{ color: '#6C63FF' }} />
          </div>
          <div>
            <h2 className="text-[#F0F0FF]" style={{ fontSize: '1.25rem', fontWeight: 600 }}>Your Content</h2>
            <p className="text-xs" style={{ color: '#8B8BAD' }}>Paste your blog content and primary keyword</p>
          </div>
        </div>

        {/* Content Textarea */}
        <div className="mb-6">
          <label className="block mb-2 text-sm" style={{ color: '#F0F0FF', fontWeight: 500 }}>
            Paste Your Blog Content
          </label>
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Paste your full article or blog post content here..."
              className="w-full rounded-xl px-4 py-3 resize-y outline-none transition-all"
              style={{
                minHeight: '280px',
                background: '#0A0A0F',
                border: '1px solid #2A2A3E',
                color: '#F0F0FF',
                fontSize: '0.875rem',
                fontFamily: "'Inter', monospace",
                lineHeight: '1.7',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#6C63FF';
                e.target.style.boxShadow = '0 0 0 3px rgba(108,99,255,0.25)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#2A2A3E';
                e.target.style.boxShadow = 'none';
              }}
            />
            <div
              className="absolute bottom-3 right-3 flex items-center gap-3 text-xs"
              style={{ color: '#4A4A6A' }}
            >
              <span>{wordCount} words</span>
              <span>|</span>
              <span>{charCount.toLocaleString()} chars</span>
            </div>
          </div>
          {wordCount > 0 && wordCount < 50 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1.5 mt-2 text-xs"
              style={{ color: '#FFB800' }}
            >
              <AlertCircle className="w-3 h-3" />
              Minimum 50 words recommended for SEO analysis
            </motion.div>
          )}
        </div>

        {/* Keyword Input */}
        <div className="mb-8">
          <label className="flex items-center gap-2 mb-2 text-sm" style={{ color: '#F0F0FF', fontWeight: 500 }}>
            <Tag className="w-4 h-4" style={{ color: '#6C63FF' }} />
            Primary Keyword
          </label>
          <motion.div
            animate={shakeKeyword ? { x: [0, -10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            <input
              type="text"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              placeholder="e.g. best hotels in London"
              className="w-full rounded-xl px-4 py-3 outline-none transition-all"
              style={{
                background: '#0A0A0F',
                border: `1px solid ${shakeKeyword ? '#FF4757' : '#2A2A3E'}`,
                color: '#F0F0FF',
                fontSize: '0.875rem',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#6C63FF';
                e.target.style.boxShadow = '0 0 0 3px rgba(108,99,255,0.25)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#2A2A3E';
                e.target.style.boxShadow = 'none';
              }}
            />
          </motion.div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs" style={{ color: '#4A4A6A' }}>
              This keyword will be naturally included in meta title & description
            </p>
            <span className="text-xs" style={{ color: '#4A4A6A' }}>
              {keyword.length} chars
            </span>
          </div>
        </div>

        {/* Generate Button */}
        <motion.button
          onClick={handleNext}
          className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 text-white transition-all cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #6C63FF, #FF6B9D, #00D4FF)',
            fontSize: '0.9375rem',
            fontWeight: 600,
          }}
          whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(108, 99, 255, 0.35)' }}
          whileTap={{ scale: 0.98 }}
        >
          <Sparkles className="w-4 h-4" />
          Generate SEO Content
        </motion.button>
      </div>
    </motion.div>
  );
}
