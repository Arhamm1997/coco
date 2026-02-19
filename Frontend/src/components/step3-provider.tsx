import { useState } from 'react';
import { motion } from 'motion/react';
import { Cpu, Key, ArrowLeft, Sparkles, Eye, EyeOff, Lock, Zap, Brain, Globe, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { AIProvider, PROVIDERS } from '../lib/types';

interface Step3Props {
  provider: AIProvider | null;
  apiKey: string;
  onProviderChange: (p: AIProvider) => void;
  onApiKeyChange: (k: string) => void;
  onGenerate: () => void;
  onBack: () => void;
  loading: boolean;
}

const providerIcons: Record<AIProvider, React.ReactNode> = {
  claude: <Brain className="w-6 h-6" />,
  openai: <Zap className="w-6 h-6" />,
  gemini: <Globe className="w-6 h-6" />,
  grok: <Bot className="w-6 h-6" />,
};

const providerColors: Record<AIProvider, string> = {
  claude: '#D4A0FF',
  openai: '#00C896',
  gemini: '#4285F4',
  grok: '#8B8BAD',
};

export function Step3Provider({
  provider,
  apiKey,
  onProviderChange,
  onApiKeyChange,
  onGenerate,
  onBack,
  loading,
}: Step3Props) {
  const [showKey, setShowKey] = useState(false);

  const selectedProvider = PROVIDERS.find((p) => p.id === provider);

  const handleGenerate = () => {
    if (!provider) {
      toast.error('Select a provider', {
        description: 'Please choose an AI provider before generating.',
      });
      return;
    }
    if (!apiKey.trim()) {
      toast.error('API key required', {
        description: 'Please enter your API key.',
      });
      return;
    }
    onGenerate();
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
        {/* Pink/purple left border */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
          style={{ background: 'linear-gradient(180deg, #6C63FF, #FF6B9D)' }}
        />
        <div
          className="absolute left-0 top-0 bottom-0 w-8"
          style={{ background: 'linear-gradient(90deg, rgba(108,99,255,0.06), transparent)' }}
        />

        {/* Section Title */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255, 107, 157, 0.15)' }}
          >
            <Cpu className="w-5 h-5" style={{ color: '#FF6B9D' }} />
          </div>
          <div>
            <h2 className="text-[#F0F0FF]" style={{ fontSize: '1.25rem', fontWeight: 600 }}>Select AI Provider</h2>
            <p className="text-xs" style={{ color: '#8B8BAD' }}>Choose your preferred AI model</p>
          </div>
        </div>

        {/* Provider Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {PROVIDERS.map((p) => {
            const isSelected = provider === p.id;
            return (
              <motion.button
                key={p.id}
                onClick={() => onProviderChange(p.id)}
                className="relative rounded-xl p-4 text-left transition-all cursor-pointer"
                style={{
                  background: isSelected
                    ? 'rgba(108, 99, 255, 0.1)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: isSelected
                    ? '1px solid rgba(108, 99, 255, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: isSelected
                    ? '0 0 20px rgba(108, 99, 255, 0.15)'
                    : 'none',
                }}
                animate={isSelected ? { scale: 1.03 } : { scale: 1 }}
                whileHover={{ scale: isSelected ? 1.03 : 1.02, borderColor: 'rgba(255,255,255,0.15)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                {isSelected && (
                  <motion.div
                    className="absolute top-2 right-2 w-2 h-2 rounded-full"
                    style={{ background: '#6C63FF' }}
                    layoutId="provider-indicator"
                  />
                )}
                <div className="mb-2" style={{ color: providerColors[p.id] }}>
                  {providerIcons[p.id]}
                </div>
                <p style={{ color: '#F0F0FF', fontSize: '0.9375rem', fontWeight: 600 }}>
                  {p.name}
                </p>
                <p className="text-xs" style={{ color: '#4A4A6A' }}>
                  {p.company} &middot; {p.model}
                </p>
              </motion.button>
            );
          })}
        </div>

        {/* API Key */}
        <div className="mb-8">
          <label className="flex items-center gap-2 mb-2 text-sm" style={{ color: '#F0F0FF', fontWeight: 500 }}>
            <Key className="w-4 h-4" style={{ color: '#FF6B9D' }} />
            API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={selectedProvider?.placeholder || 'Select a provider first...'}
              className="w-full rounded-xl px-4 py-3 pr-12 outline-none transition-all"
              style={{
                background: '#0A0A0F',
                border: '1px solid #2A2A3E',
                color: '#F0F0FF',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
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
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded cursor-pointer transition-colors hover:bg-white/5"
              style={{ color: '#4A4A6A' }}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Lock className="w-3 h-3" style={{ color: '#4A4A6A' }} />
            <span className="text-xs" style={{ color: '#4A4A6A' }}>
              Your key is never stored. It's used only for this request.
            </span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <motion.button
            onClick={onBack}
            className="px-6 py-3.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
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
            <ArrowLeft className="w-4 h-4" />
            Back
          </motion.button>
          <motion.button
            onClick={handleGenerate}
            disabled={loading}
            className="flex-1 py-4 rounded-xl flex items-center justify-center gap-2 text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #6C63FF, #FF6B9D, #00D4FF)',
              fontSize: '0.9375rem',
              fontWeight: 600,
            }}
            whileHover={
              !loading
                ? { y: -2, boxShadow: '0 8px 30px rgba(108, 99, 255, 0.35)' }
                : {}
            }
            whileTap={!loading ? { scale: 0.98 } : {}}
          >
            {loading ? (
              <>
                <div
                  className="w-4 h-4 border-2 rounded-full animate-spin-slow"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
                />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate SEO Content
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
