"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTour } from '@/demo/tour-context';

export function DemoSpotlightOverlay() {
  const { activeScenario, targetRect, currentStepIndex } = useTour();

  if (!activeScenario) return null;

  const isLastStep = activeScenario && currentStepIndex === activeScenario.steps.length - 1;
  const padding = 8;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9990] overflow-hidden">
        { targetRect && !isLastStep ? (
          <>
            {/* SVG Cutout Mask */}
            <svg className="absolute inset-0 w-full h-full">
              <defs>
                <mask id="demo-spotlight-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  <motion.rect
                    animate={{
                      x: targetRect.left - padding,
                      y: targetRect.top - padding,
                      width: targetRect.width + padding * 2,
                      height: targetRect.height + padding * 2,
                    }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    rx="12"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="rgba(15, 23, 42, 0.65)"
                mask="url(#demo-spotlight-mask)"
              />
            </svg>

            {/* Animated Glowing Bounding Box */}
            <motion.div
              animate={{
                x: targetRect.left - padding,
                y: targetRect.top - padding,
                width: targetRect.width + padding * 2,
                height: targetRect.height + padding * 2,
              }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute rounded-xl border-2 border-[#FF6633] shadow-[0_0_25px_rgba(255,102,51,0.35)]"
            >
              {/* Subtle corner accent markers */}
              <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white rounded-tl" />
              <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white rounded-tr" />
              <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white rounded-bl" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white rounded-br" />
            </motion.div>
          </>
        ) : (
          /* Soft dim backdrop when element is loading or in transit */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          />
        )}
    </div>
  );
}
