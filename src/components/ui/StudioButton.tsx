import React from 'react';
import { cn } from '../../lib/utils';

export type StudioButtonVariant = 'primary' | 'secondary' | 'tab' | 'ghost';

export interface StudioButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: StudioButtonVariant;
  size?: 'compact' | 'normal';
  active?: boolean;
}

/**
 * Shared interaction language for Joelizer's global navigation and studio
 * toolbars. One height scale, radius, focus ring, tap target and disabled
 * treatment everywhere; active states are semantic, not separate button types.
 */
export const StudioButton = React.forwardRef<HTMLButtonElement, StudioButtonProps>(
  ({ variant = 'secondary', size = 'normal', active = false, className, type = 'button', children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={props['aria-pressed'] ?? (variant === 'tab' ? active : undefined)}
      {...props}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border font-semibold',
        'transition-[background-color,border-color,color,box-shadow] duration-150',
        'cursor-pointer select-none whitespace-nowrap',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d10]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'compact' ? 'h-8 px-2.5 text-[11px]' : 'min-h-9 px-3 text-[11px]',
        variant === 'primary' && 'border-transparent bg-accent text-[#07120d] hover:brightness-110 active:brightness-95',
        variant === 'secondary' && 'border-[#323b49] bg-[#171e26] text-[#e4e8ed] hover:border-[#4a5768] hover:bg-[#222c38]',
        variant === 'ghost' && 'border-transparent bg-transparent text-[#9eabb9] hover:bg-[#1c2630] hover:text-white',
        variant === 'tab' && (active
          ? 'border-accent/40 bg-accent/10 text-[#f4f7f9]'
          : 'border-transparent bg-transparent text-[#9eabb9] hover:border-[#323b49] hover:bg-[#1b242f] hover:text-white'),
        className
      )}
    >
      {children}
    </button>
  )
);

StudioButton.displayName = 'StudioButton';
