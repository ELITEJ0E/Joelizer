import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePopstateModal } from '../../hooks/usePopstateModal';

let openDialogCount = 0;
let previousBodyOverflow = '';

/**
 * Draws MV Studio dialogs in the document/fullscreen top-level layer instead
 * of inside the narrow sidebar's overflow and z-index stacking context.
 * This prevents the timeline, playback overlay, and preview from painting
 * above the dialog, even at small viewport sizes.
 */
export function MVDialogPortal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [host, setHost] = useState<Element | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const { handleClose } = usePopstateModal(true, () => closeRef.current());
  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;

  useEffect(() => {
    const updateHost = () => setHost(document.fullscreenElement || document.body);
    updateHost();
    document.addEventListener('fullscreenchange', updateHost);
    return () => document.removeEventListener('fullscreenchange', updateHost);
  }, []);

  useEffect(() => {
    if (!host) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (openDialogCount++ === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    const reportState = () => window.dispatchEvent(new Event('mv-dialog-state'));
    reportState();
    requestAnimationFrame(() => {
      const firstButton = dialogRef.current?.querySelector<HTMLElement>('button:not([disabled])');
      (firstButton || dialogRef.current)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (document.querySelector('[role="listbox"][data-state="open"]')) return;
        event.preventDefault();
        event.stopPropagation();
        handleCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = (Array.from(dialogRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )) as HTMLElement[]).filter(el => el.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      openDialogCount = Math.max(0, openDialogCount - 1);
      if (openDialogCount === 0) document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.isConnected && previouslyFocused.focus();
      reportState();
    };
  }, [host]);

  if (!host) return null;
  return createPortal(
    <div
      data-mv-dialog=""
      className="fixed inset-0 z-[10000] bg-[#030509]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto overscroll-contain"
      onPointerDown={event => {
        event.stopPropagation();
        if (event.target === event.currentTarget) handleCloseRef.current();
      }}
      onClick={event => event.stopPropagation()}
      onDragOver={event => { event.preventDefault(); event.stopPropagation(); }}
      onDrop={event => { event.preventDefault(); event.stopPropagation(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onPointerDown={event => event.stopPropagation()}
        className="w-full max-w-lg min-w-0 max-h-[min(90dvh,780px)] overflow-y-auto rounded-2xl border border-[#374151] bg-[#10151c] p-4 sm:p-5 shadow-[0_28px_100px_rgba(0,0,0,0.9)] text-[#e5e7eb] focus:outline-none"
      >
        {children}
      </div>
    </div>,
    host
  );
}
