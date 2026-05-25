'use client';

import { useEffect, useRef } from 'react';
import { useNavigationGuardContext } from '@/context/NavigationGuardContext';

/**
 * Blocks navigation while `isActive` is true.
 * Calls `onBlock(proceed)` - show confirmation UI, then call `proceed()` to allow.
 */
export function useNavigationGuard(
  isActive: boolean,
  onBlock: (proceed: () => void) => void
) {
  const { guardRef } = useNavigationGuardContext();
  const onBlockRef = useRef(onBlock);
  useEffect(() => {
    onBlockRef.current = onBlock;
  });

  // Register/unregister guard in shared ref (no re-renders needed)
  useEffect(() => {
    if (isActive) {
      guardRef.current = (proceed) => onBlockRef.current(proceed);
    } else {
      guardRef.current = null;
    }
    return () => {
      guardRef.current = null;
    };
  }, [isActive, guardRef]);

  // Browser close / refresh
  useEffect(() => {
    if (!isActive) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isActive]);
}
