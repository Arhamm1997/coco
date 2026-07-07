import { useState, useEffect, useCallback, useRef } from 'react';
import { checkBackendHealth } from '../lib/api';

export type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

const POLL_INTERVAL_MS = 30_000;
const INITIAL_RETRIES = 3;
const RETRY_DELAY_MS = 3_000;

export function useBackendHealth(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const initialDone = useRef(false);

  const check = useCallback(async () => {
    const ok = await checkBackendHealth();
    setStatus(ok ? 'connected' : 'disconnected');
  }, []);

  // On first mount, retry a few times before declaring disconnected
  const initialCheck = useCallback(async () => {
    for (let i = 0; i < INITIAL_RETRIES; i++) {
      const ok = await checkBackendHealth();
      if (ok) {
        setStatus('connected');
        return;
      }
      if (i < INITIAL_RETRIES - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }
    }
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    if (!initialDone.current) {
      initialDone.current = true;
      initialCheck();
    }

    // Poll every 30 seconds
    const interval = setInterval(check, POLL_INTERVAL_MS);

    // Re-check when tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        check();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [check]);

  return status;
}
