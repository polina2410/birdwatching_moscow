import { useEffect, RefObject } from 'react';

type Options = {
  ref?: RefObject<HTMLElement | null>;
  escape?: boolean;
  touch?: boolean;
};

export function useClickOutside(
  onClose: () => void,
  options: Options = {}
) {
  const { ref, escape = false, touch = false } = options;

  useEffect(() => {
    const handlePointer = (e: MouseEvent | TouchEvent) => {
      if (ref?.current && ref.current.contains(e.target as Node)) return;
      onClose();
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointer as EventListener);
    if (touch) document.addEventListener('touchstart', handlePointer as EventListener);
    if (escape) document.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('mousedown', handlePointer as EventListener);
      if (touch) document.removeEventListener('touchstart', handlePointer as EventListener);
      if (escape) document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose, ref, escape, touch]);
}
