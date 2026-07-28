'use client';

import { useState } from 'react';
import { AUTH_ERRORS } from '@/lib/auth-errors';

export function useAuthForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setLoading(true);
    try {
      await action();
    } catch {
      setError(AUTH_ERRORS.network);
    } finally {
      setLoading(false);
    }
  };

  return { error, setError, loading, run };
}
