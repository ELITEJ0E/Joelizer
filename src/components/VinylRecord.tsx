'use client';

import { motion } from 'motion/react';
import { memo } from 'react';

// Simple Tailwind-friendly class merging helper
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface VinylRecordProps {
  isPlaying: boolean;
  coverImage?: string;
}

export const VinylRecord = memo(function VinylRecord({ isPlaying, coverImage }: VinylRecordProps) {
  return (
    <div className="relative flex justify-center items-center py-6 group">
      {/* Outer Dynamic Glow */}
      <motion.div
        animate={{
          scale: isPlaying ? [1, 1.05, 1] : 1,
          opacity: isPlaying ? [0.3, 0.5, 0.3] : 0.1,
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[300px] h-[300px] sm:w-[340px] sm:h-[340px] rounded-full bg-white/20 blur-[60px] pointer-events-none"
      />

      {/* Record Base Shadow drop */}
      <div className={cn(
        "absolute w-[260px] h-[260px] sm:w-[300px] sm:h-[300px] rounded-full bg-black/50 blur-[20px] translate-y-6 transition-all duration-700",
        isPlaying ? "opacity-70 scale-100" : "opacity-40 scale-95"
      )} />

      {/* The Vinyl Disc Frame */}
      <div className="relative w-[260px] h-[260px] sm:w-[300px] sm:h-[300px] rounded-full border border-black/80 shadow-[0_0_20px_rgba(0,0,0,0.8),inset_0_0_10px_rgba(0,0,0,0.9)] bg-neutral-900 pointer-events-none isolate">
        
        {/* The Spinning Layer */}
        <div
          className="absolute inset-0 rounded-full overflow-hidden"
          style={{
            animation: 'spin 3.5s linear infinite',
            animationPlayState: isPlaying ? 'running' : 'paused',
            transform: 'translate3d(0, 0, 0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            perspective: 1000,
          }}
        >
          {/* Base Vinyl Color and Grooves */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #111 0%, #292929 50%, #050505 100%)',
            }}
          >
             {/* Realistic Grooves using repeating-radial-gradient */}
             <div 
                className="absolute inset-0 opacity-50 mix-blend-overlay"
                style={{
                  background: 'repeating-radial-gradient(circle at 50% 50%, transparent, transparent 1.5px, #000 2px, #333 3.5px)'
                }}
             />
             {/* Reflective Sheen rotating with the record */}
             <div 
                className="absolute inset-0 opacity-40 mix-blend-color-dodge transition-opacity duration-1000"
                style={{
                  background: 'conic-gradient(from 45deg, transparent 0deg, rgba(255,255,255,0.5) 30deg, transparent 60deg, transparent 180deg, rgba(255,255,255,0.5) 210deg, transparent 240deg)'
                }}
             />
          </div>

          {/* Center Label Area */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] rounded-full shadow-[0_0_15px_rgba(0,0,0,0.9)] border-[4px] border-zinc-800 bg-neutral-900 flex items-center justify-center z-10 overflow-hidden">
            <motion.div 
               className="w-full h-full relative"
               animate={{ scale: isPlaying ? [1, 1.02, 1] : 1 }}
               transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
            >
              {coverImage ? (
                <img src={coverImage} alt="Cover Artwork" className="w-full h-full object-cover opacity-95 pointer-events-none" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center relative">
                   <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,white_0%,transparent_100%)]" />
                   <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shadow-lg">
                     <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]" />
                   </div>
                </div>
              )}
            </motion.div>
            
            {/* Inner Ring effect on Label */}
            <div className="absolute inset-0 rounded-full border-[2px] border-white/5 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] z-20 pointer-events-none" />

            {/* The absolute center spindle hole */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-zinc-950 shadow-[inset_0_1px_3px_1px_rgba(0,0,0,1)] border border-white/10 z-30 flex items-center justify-center">
               <div className="w-1.5 h-1.5 rounded-full bg-[#444] shadow-[0_1px_1px_rgba(255,255,255,0.4)]" />
            </div>
          </div>
        </div>
        
        {/* Static Light Reflection Overlay */}
        <div className="absolute inset-0 rounded-full pointer-events-none mix-blend-soft-light opacity-[0.65]"
             style={{
               background: 'linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.7) 45%, rgba(255,255,255,0) 60%)'
             }} 
        />
      </div>
      
      {/* Tonearm System */}
      <div className="absolute top-0 sm:-top-4 -right-4 sm:-right-8 w-32 sm:w-40 h-40 sm:h-52 pointer-events-none drop-shadow-2xl z-30 transform-gpu origin-[80px_20px] transition-transform duration-700 cubic-bezier(0.34, 1.56, 0.64, 1)"
           style={{
             transform: isPlaying ? 'rotate(2deg)' : 'rotate(-18deg)',
           }}
      >
         {/* Tonearm Pivot Base */}
         <div className="absolute top-2 right-4 w-12 h-12 rounded-full bg-gradient-to-br from-zinc-500 via-zinc-700 to-zinc-900 border-2 border-zinc-800 shadow-[0_10px_20px_rgba(0,0,0,0.8)] flex items-center justify-center ring-1 ring-white/10 z-20">
            <div className="absolute inset-1 rounded-full border border-black/50" />
            <div className="w-6 h-6 rounded-full bg-gradient-to-b from-zinc-800 to-black border border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] flex items-center justify-center">
               <div className="w-2 h-2 rounded-full bg-[#111] shadow-inner" />
            </div>
            {/* Pivot ring highlights */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/0 via-white/20 to-white/0 mix-blend-overlay" />
         </div>
         
         {/* The Arm Line & Headshell (SVG) */}
         <svg viewBox="0 0 120 180" className="absolute top-5 right-8 w-24 sm:w-28 h-36 sm:h-44 opacity-100 drop-shadow-[5px_15px_15px_rgba(0,0,0,0.6)] z-10 overflow-visible">
            {/* Counterweight */}
            <rect x="75" y="-5" width="10" height="20" rx="3" fill="url(#metalDark)" filter="url(#shadow)" />
            <rect x="73" y="15" width="14" height="6" rx="1" fill="#333" />
            <rect x="77" y="21" width="6" height="5" fill="#111" />
            
            {/* The tube / arm */}
            <path 
              d="M 80 25 C 80 80, 40 90, 30 140" 
              fill="none" 
              stroke="url(#armGrad)" 
              strokeWidth="5" 
              strokeLinecap="round" 
              filter="url(#shadow)"
            />
            {/* The tube highlight */}
            <path 
              d="M 80 25 C 80 80, 40 90, 30 140" 
              fill="none" 
              stroke="#fff" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              opacity="0.3"
            />
            
            {/* The headshell joint */}
            <circle cx="30" cy="140" r="3" fill="#666" />
            
            {/* The headshell */}
            <path 
               d="M 28 140 L 22 165 L 38 168 L 33 140 Z"
               fill="#1a1a1a"
               stroke="#333"
               strokeWidth="1"
               filter="url(#shadow)"
               strokeLinejoin="round"
            />
            
            {/* The cartridge detailing */}
            <rect x="25" y="150" width="8" height="12" fill="#ef4444" transform="rotate(5, 29, 156)" />
            <line x1="26" y1="155" x2="32" y2="155" stroke="#fff" strokeWidth="0.5" opacity="0.3" transform="rotate(5, 29, 156)" />
            
            {/* The stylus / needle point */}
            <polygon points="27,166 29,166 28,172" fill="#d4d4d8" transform="rotate(5, 28, 169)" />

            <defs>
              <linearGradient id="armGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#a1a1aa" />
                <stop offset="30%" stopColor="#f4f4f5" />
                <stop offset="70%" stopColor="#d4d4d8" />
                <stop offset="100%" stopColor="#71717a" />
              </linearGradient>
              <linearGradient id="metalDark" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3f3f46" />
                <stop offset="50%" stopColor="#71717a" />
                <stop offset="100%" stopColor="#27272a" />
              </linearGradient>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="-2" dy="5" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
              </filter>
            </defs>
         </svg>
      </div>
    </div>
  );
});

export default VinylRecord;
