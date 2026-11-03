import { useEffect, useRef, useCallback } from 'react';

/**
 * Back-button handling for overlays.
 *
 * StrictMode replays useEffect cleanup/setup in development. The previous
 * implementation called history.back() from that cleanup, so a newly opened
 * export dialog could immediately close on its first render. Lifecycle cleanup
 * now only detaches the listener; browser history is traversed on an explicit
 * modal close or on a real user Back.
 */
export function usePopstateModal(isOpen: boolean, onClose: () => void) {
  const hasPushedStateRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    // Only push once per open lifecycle, even if StrictMode replays the effect.
    if (!hasPushedStateRef.current) {
      window.history.pushState({ ...(window.history.state || {}), modalOpen: true }, '');
      hasPushedStateRef.current = true;
    }

    const handlePopState = () => {
      if (!hasPushedStateRef.current) return;
      hasPushedStateRef.current = false;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      // Do not mutate history here: StrictMode effects are replayed.
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (hasPushedStateRef.current) {
      hasPushedStateRef.current = false;
      try {
        window.history.back();
      } catch (_) {
        // Closing the dialog must not depend on browser history permissions.
      }
    }
    onCloseRef.current();
  }, []);

  return { handleClose };
}
