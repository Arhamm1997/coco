import { motion } from 'motion/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}

export function ErrorState({ message, onRetry, onBack }: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div
        className="rounded-2xl p-8 relative overflow-hidden"
        style={{
          background: 'rgba(255, 71, 87, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 71, 87, 0.2)',
        }}
      >
        <div className="flex flex-col items-center text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(255, 71, 87, 0.1)' }}
          >
            <AlertTriangle className="w-7 h-7" style={{ color: '#FF4757' }} />
          </div>
          <h3 className="mb-2" style={{ color: '#FF4757', fontSize: '1.125rem', fontWeight: 600 }}>
            Something went wrong
          </h3>
          <p
            className="mb-6 max-w-md text-sm"
            style={{ color: '#C8C8E0', lineHeight: '1.6' }}
          >
            {message}
          </p>
          <div className="flex gap-3">
            <motion.button
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm cursor-pointer transition-all"
              style={{
                background: 'transparent',
                border: '1px solid #2A2A3E',
                color: '#8B8BAD',
                fontWeight: 500,
              }}
              whileHover={{ borderColor: '#4A4A6A' }}
              whileTap={{ scale: 0.98 }}
            >
              Go Back
            </motion.button>
            <motion.button
              onClick={onRetry}
              className="px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm text-white cursor-pointer transition-all"
              style={{
                background: 'linear-gradient(135deg, #FF4757, #FF6B9D)',
                fontWeight: 600,
              }}
              whileHover={{ y: -1, boxShadow: '0 4px 15px rgba(255,71,87,0.3)' }}
              whileTap={{ scale: 0.98 }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
