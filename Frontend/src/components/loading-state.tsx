import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Loader2 } from 'lucide-react';
import { PROVIDERS, AIProvider } from '../lib/types';

interface LoadingStateProps {
  provider: AIProvider;
  urlCount: number;
}

interface StepItem {
  label: string;
  delay: number;
}

export function LoadingState({ provider, urlCount }: LoadingStateProps) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  const providerInfo = PROVIDERS.find((p) => p.id === provider);

  const steps: StepItem[] = [
    { label: 'Parsing your content...', delay: 300 },
    { label: `Loading ${urlCount} URLs from spreadsheet...`, delay: 800 },
    { label: 'Verifying URLs are live...', delay: 2000 },
    { label: `Sending to ${providerInfo?.name || 'AI'} AI...`, delay: 3500 },
    { label: 'Processing SEO output...', delay: 5000 },
  ];

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    steps.forEach((step, index) => {
      // Activate step
      timers.push(
        setTimeout(() => {
          setActiveStep(index);
        }, step.delay)
      );

      // Complete step (500ms after activation, except the last 2)
      if (index < steps.length - 2) {
        timers.push(
          setTimeout(() => {
            setCompletedSteps((prev) => [...prev, index]);
          }, step.delay + 500)
        );
      }
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div
        className="rounded-2xl p-8 sm:p-12 relative overflow-hidden animate-pulse-glow"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Animated gradient border */}
        <div
          className="absolute inset-0 rounded-2xl opacity-30"
          style={{
            background: 'linear-gradient(135deg, transparent, rgba(108,99,255,0.1), transparent, rgba(0,212,255,0.1))',
            backgroundSize: '400% 400%',
            animation: 'shimmer 4s ease infinite',
          }}
        />

        <div className="relative z-10 flex flex-col items-center">
          {/* Spinner */}
          <div className="relative w-20 h-20 mb-8">
            <div
              className="absolute inset-0 rounded-full animate-spin-slow"
              style={{
                border: '3px solid transparent',
                borderTopColor: '#6C63FF',
                borderRightColor: '#00D4FF',
              }}
            />
            <div
              className="absolute inset-2 rounded-full animate-spin-slow"
              style={{
                border: '2px solid transparent',
                borderBottomColor: '#FF6B9D',
                animationDirection: 'reverse',
                animationDuration: '1.5s',
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  background: '#6C63FF',
                  boxShadow: '0 0 20px rgba(108,99,255,0.5)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            </div>
          </div>

          {/* Title */}
          <h3
            className="mb-2 gradient-text"
            style={{ fontSize: '1.25rem', fontWeight: 600 }}
          >
            Generating SEO Content
          </h3>
          <p className="text-xs mb-8" style={{ color: '#4A4A6A' }}>
            This usually takes 15-30 seconds
          </p>

          {/* Steps */}
          <div className="w-full max-w-sm space-y-3">
            {steps.map((step, index) => {
              const isCompleted = completedSteps.includes(index);
              const isActive = activeStep >= index && !isCompleted;
              const isVisible = activeStep >= index;

              if (!isVisible) return null;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-3"
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <Check className="w-4 h-4" style={{ color: '#00C896' }} />
                    </motion.div>
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#6C63FF' }} />
                  ) : (
                    <div className="w-4 h-4 rounded-full" style={{ background: '#2A2A3E' }} />
                  )}
                  <span
                    className="text-sm"
                    style={{
                      color: isCompleted ? '#00C896' : isActive ? '#F0F0FF' : '#4A4A6A',
                    }}
                  >
                    {step.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
