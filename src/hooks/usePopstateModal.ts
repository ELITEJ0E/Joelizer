import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to manage modal/dialog dismissal via browser back button (popstate).
 * When the modal is opened, it pushes a entry into window.history.
 * If the user presses Back or swipes back, popstate fires and closes the modal instead of navigating away.
 */
export function usePopstateModal(isOpen: boolean, onClose: () => void) {
  const hasPushedStateRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasPushedStateRef.current = false;
      return;
    }

    // Push history state when modal opens
    window.history.pushState({ modalOpen: true }, '');
    hasPushedStateRef.current = true;

    const handlePopState = () => {
      // Browser back button pressed
      hasPushedStateRef.current = false;
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // If modal unmounts while history was pushed, pop the history state
      if (hasPushedStateRef.current) {
        hasPushedStateRef.current = false;
        try {
          window.history.back();
        } catch (_) {}
      }
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (hasPushedStateRef.current) {
      hasPushedStateRef.current = false;
      try {
        window.history.back();
      } catch (_) {}
    }
    onClose();
  }, [onClose]);

  return { handleClose };
}
