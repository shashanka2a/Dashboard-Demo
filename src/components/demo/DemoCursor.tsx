"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTour } from '@/demo/tour-context';

export function DemoCursor() {
  const { cursor } = useTour();

  if (!cursor.visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      <motion.div
        animate={{
          x: cursor.x,
          y: cursor.y,
          scale: cursor.clicking ? 0.82 : 1,
        }}
        transition={{
          type: 'spring',
          damping: 28,
          stiffness: 300,
          mass: 0.5,
        }}
        className="relative"
      >
        {/* SVG Cursor Pointer */}
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-lg -translate-x-1 -translate-y-1"
        >
          <path
            d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
            fill="#FF6633"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>

        {/* Click Ripple Effect */}
        <AnimatePresence>
          {cursor.clicking && (
            <motion.div
              initial={{ scale: 0.2, opacity: 0.9 }}
              animate={{ scale: 2.4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full border-2 border-[#FF6633] bg-[#FF6633]/20"
            />
          )}
        </AnimatePresence>

        {/* Typing indicator bubble */}
        {cursor.text && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute left-6 top-4 rounded-md bg-gray-900/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-medium text-white shadow-md border border-gray-700/50 flex items-center gap-1.5"
          >
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6633] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#FF6633]"></span>
            </span>
            {cursor.text}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
