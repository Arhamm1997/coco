import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Toaster } from 'sonner';
import { toast } from 'sonner';

import { Navbar } from './components/navbar';
import { ProgressBar } from './components/progress-bar';
import { Step1Content } from './components/step1-content';
import { Step4Results } from './components/step4-results';
import { LoadingState } from './components/loading-state';
import { ErrorState } from './components/error-state';
import { SettingsPage } from './components/settings-page';

import { AIProvider, SEOResult, PROVIDERS } from './lib/types';
import { callAI, checkUrls } from './lib/api';

const stepVariants = {
  initial: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 60 : -60,
  }),
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -60 : 60,
    transition: { duration: 0.3 },
  }),
};

export default function App() {
  // Main flow: step 1 = Content & Keyword, step 2 = Results
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

  // Content state
  const [content, setContent] = useState('');
  const [keyword, setKeyword] = useState('');

  // Settings state (persisted across content generations)
  const [urls, setUrls] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [provider, setProvider] = useState<AIProvider | null>(null);
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');

  // Generation state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SEOResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUrlsChange = useCallback((newUrls: string[], name: string) => {
    setUrls(newUrls);
    setFileName(name);
  }, []);

  const handleProviderChange = useCallback((p: AIProvider) => {
    setProvider(p);
    const info = PROVIDERS.find((pr) => pr.id === p);
    setModel(info?.model ?? '');
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!provider || !apiKey.trim()) {
      toast.error('Settings required', {
        description: 'Please configure your AI provider and API key in Settings first.',
      });
      setShowSettings(true);
      return;
    }

    if (urls.length === 0) {
      toast.error('URLs required', {
        description: 'Please upload a URL spreadsheet in Settings first.',
      });
      setShowSettings(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check URLs in parallel (best effort - may fail due to CORS)
      let liveUrls = urls;
      try {
        const urlStatus = await checkUrls(urls);
        const live = urls.filter((u) => urlStatus.get(u) !== false);
        if (live.length > 0) {
          liveUrls = live;
        }
      } catch {
        // URL checking failed (CORS), use all URLs
        liveUrls = urls;
      }

      if (liveUrls.length === 0) {
        toast.warning('No live URLs found', {
          description: 'All URLs appear to be unreachable. Using all URLs anyway.',
        });
        liveUrls = urls;
      }

      // Call AI API
      const result = await callAI(provider, apiKey, content, keyword, liveUrls, model);

      // Mark all links as live (since we can't reliably check from browser)
      if (result.internalLinks) {
        result.internalLinks = result.internalLinks.map((link) => ({
          ...link,
          isLive: true,
        }));
      }

      setResults(result);
      setDirection(1);
      setStep(2);
      toast.success('SEO content generated successfully!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(message);
      toast.error('Generation failed', { description: message });
    } finally {
      setLoading(false);
    }
  }, [provider, apiKey, urls, content, keyword, model]);

  const handleStartOver = useCallback(() => {
    setDirection(-1);
    setStep(1);
    setContent('');
    setKeyword('');
    setResults(null);
    setError(null);
    setLoading(false);
    // urls, fileName, provider, apiKey are intentionally preserved
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    handleGenerate();
  }, [handleGenerate]);

  const handleErrorBack = useCallback(() => {
    setError(null);
    setDirection(-1);
    setStep(1);
  }, []);

  const openSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  return (
    <div className="min-h-screen relative" style={{ background: '#0A0A0F', fontFamily: "'Inter', sans-serif" }}>
      {/* Ambient gradient orbs */}
      <div
        className="fixed top-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: 'rgba(108, 99, 255, 0.12)',
          filter: 'blur(150px)',
          transform: 'translate(-30%, -30%)',
        }}
      />
      <div
        className="fixed bottom-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'rgba(0, 212, 255, 0.08)',
          filter: 'blur(150px)',
          transform: 'translate(30%, 30%)',
        }}
      />

      {/* Sonner Toaster */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1A1A2E',
            border: '1px solid #2A2A3E',
            color: '#F0F0FF',
          },
        }}
      />

      {/* Navbar */}
      <Navbar onSettingsClick={openSettings} />

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-10">
        <AnimatePresence mode="wait" custom={direction}>
          {showSettings ? (
            <motion.div
              key="settings"
              custom={direction}
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <SettingsPage
                urls={urls}
                fileName={fileName}
                provider={provider}
                model={model}
                apiKey={apiKey}
                onUrlsChange={handleUrlsChange}
                onProviderChange={handleProviderChange}
                onModelChange={setModel}
                onApiKeyChange={setApiKey}
                onClose={closeSettings}
              />
            </motion.div>
          ) : loading ? (
            <motion.div
              key="loading"
              custom={direction}
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <LoadingState provider={provider!} urlCount={urls.length} />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              custom={direction}
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <ErrorState
                message={error}
                onRetry={handleRetry}
                onBack={handleErrorBack}
              />
            </motion.div>
          ) : (
            <motion.div
              key={step}
              custom={direction}
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {/* Progress Bar — only shown on main steps */}
              <ProgressBar currentStep={step} />

              {step === 1 && (
                <Step1Content
                  content={content}
                  keyword={keyword}
                  onContentChange={setContent}
                  onKeywordChange={setKeyword}
                  onNext={handleGenerate}
                />
              )}
              {step === 2 && results && (
                <Step4Results
                  results={results}
                  provider={provider!}
                  keyword={keyword}
                  onStartOver={handleStartOver}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8">
        <p className="text-xs" style={{ color: '#4A4A6A' }}>
          SEOBoost &mdash; AI-powered SEO content optimizer
        </p>
      </footer>
    </div>
  );
}
