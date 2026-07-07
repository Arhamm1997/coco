import { motion } from 'motion/react';
import { Check } from 'lucide-react';

const steps = [
  { num: 1, label: 'Content & Keyword' },
  { num: 2, label: 'Results' },
];

interface ProgressBarProps {
  currentStep: number;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-10">
      <div className="flex items-center justify-between relative">
        {/* Background line */}
        <div className="absolute top-5 left-0 right-0 h-0.5" style={{ background: '#2A2A3E' }} />
        {/* Animated fill line */}
        <motion.div
          className="absolute top-5 left-0 h-0.5"
          style={{ background: 'linear-gradient(90deg, #6C63FF, #00D4FF)' }}
          initial={{ width: '0%' }}
          animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />

        {steps.map((step) => {
          const isCompleted = currentStep > step.num;
          const isActive = currentStep === step.num;
          const isFuture = currentStep < step.num;

          return (
            <div key={step.num} className="flex flex-col items-center relative z-10">
              <motion.div
                className="w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors"
                style={{
                  background: isCompleted
                    ? '#6C63FF'
                    : isActive
                    ? '#0A0A0F'
                    : '#111118',
                  borderColor: isCompleted
                    ? '#6C63FF'
                    : isActive
                    ? '#6C63FF'
                    : '#2A2A3E',
                  boxShadow: isActive
                    ? '0 0 0 4px rgba(108, 99, 255, 0.2), 0 0 20px rgba(108, 99, 255, 0.15)'
                    : 'none',
                }}
                animate={
                  isActive
                    ? {
                        boxShadow: [
                          '0 0 0 4px rgba(108, 99, 255, 0.2), 0 0 20px rgba(108, 99, 255, 0.15)',
                          '0 0 0 8px rgba(108, 99, 255, 0.1), 0 0 30px rgba(108, 99, 255, 0.2)',
                          '0 0 0 4px rgba(108, 99, 255, 0.2), 0 0 20px rgba(108, 99, 255, 0.15)',
                        ],
                      }
                    : {}
                }
                transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <Check className="w-4 h-4 text-white" />
                  </motion.div>
                ) : (
                  <span
                    style={{
                      color: isActive ? '#6C63FF' : '#4A4A6A',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                    }}
                  >
                    {step.num}
                  </span>
                )}
              </motion.div>
              <span
                className="mt-2 text-xs whitespace-nowrap hidden sm:block"
                style={{
                  color: isCompleted || isActive ? '#F0F0FF' : '#4A4A6A',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
