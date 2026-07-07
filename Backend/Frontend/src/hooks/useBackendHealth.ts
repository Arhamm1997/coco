import { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth } from '../lib/api';

export type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

const POLL_INTERVAL_MS = 30_000;

export function useBackendHealth(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('checking');

  const check = useCallback(async () => {
    const ok = await checkBackendHealth();
    setStatus(ok ? 'connected' : 'disconnected');
  }, []);

  useEffect(() => {
    // Check immediately on mount
    check();

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
