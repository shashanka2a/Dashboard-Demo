"use client";

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, ChevronLeft, ChevronRight, SkipForward, X, Shield, Check } from 'lucide-react';
import { useTour } from '@/demo/tour-context';

export function DemoTooltip() {
  const {
    activeScenario,
    currentStepIndex,
    currentStep,
    isPlaying,
    stepProgress,
    targetRect,
    pauseTour,
    resumeTour,
    nextStep,
    prevStep,
    skipScenario,
    exitTour,
  } = useTour();

  const totalSteps = activeScenario?.steps.length ?? 0;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = activeScenario ? currentStepIndex === totalSteps - 1 : false;

  const coords = useMemo(() => {
    if (typeof window === 'undefined') return { top: 120, left: 120 };

    const tooltipWidth = 400;
    const tooltipHeight = 240;
    const margin = 16;

      // Center on screen for final step ("Tour Complete") or if no target element exists
      if (!targetRect || isLastStep) {
        return {
          top: Math.max(80, window.innerHeight / 2 - tooltipHeight / 2),
          left: Math.max(20, window.innerWidth / 2 - tooltipWidth / 2),
        };
      }

      let top: number;
      let left: number;

      // If target is in the sidebar (left rail or sub-nav), place to the RIGHT of the element
      if (targetRect.left < 340 && targetRect.width <= 300) {
        left = targetRect.right + margin + 8;
        top = Math.max(20, Math.min(window.innerHeight - tooltipHeight - 20, targetRect.top - 8));
      } else {
        // Default: try placing BELOW target
        top = targetRect.bottom + margin;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;

        // If bottom overflows viewport, place ABOVE
        if (top + tooltipHeight > window.innerHeight - 20) {
          top = targetRect.top - tooltipHeight - margin;
        }

        // Keep within horizontal screen bounds
        if (left < 20) left = 20;
        if (left + tooltipWidth > window.innerWidth - 20) {
          left = window.innerWidth - tooltipWidth - 20;
        }

        // If still off-screen on top
        if (top < 20) {
          top = 20;
        }
      }

      return { top, left };
}, [targetRect, isLastStep]);

if (!activeScenario || !currentStep) return null;

return (
  <AnimatePresence mode="wait">
    <motion.div
      key={`${activeScenario.id}-${currentStep.id}`}
      initial={{ opacity: 0, scale: 0.97, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: -8 }}
      transition={{ type: 'spring', damping: 28, stiffness: 400 }}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        width: isLastStep ? 420 : 380,
        zIndex: 9998,
      }}
      className={`rounded-xl border border-[#2a2a2e] bg-[#121214]/98 text-white p-4 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl pointer-events-auto ${isLastStep ? 'ring-1 ring-[#FF5722]/30' : ''
        }`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-800/90 text-zinc-300 border border-zinc-700/60">
            <span className={`w-1.5 h-1.5 rounded-full ${isLastStep ? 'bg-emerald-400' : 'bg-[#FF5722]'}`} />
            {currentStep.badge}
          </span>
          <span className="text-[11px] text-zinc-500 font-medium">
            Step {currentStepIndex + 1} of {totalSteps}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {!isLastStep && (
            <button
              onClick={skipScenario}
              title="Skip this scenario"
              className="px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-800/80 transition-colors flex items-center gap-1"
            >
              <SkipForward className="w-3 h-3" />
              Skip
            </button>
          )}
          <button
            onClick={exitTour}
            title="Exit walkthrough"
            className="p-1 text-zinc-400 hover:text-zinc-200 rounded-md hover:bg-zinc-800/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 data-tour="tooltip-title" className="text-sm font-semibold text-white mb-1.5 leading-snug">
        {currentStep.title}
      </h3>

      {/* Description */}
      <p className="text-[13px] leading-relaxed text-zinc-300 mb-3">
        {currentStep.explanation}
      </p>

      {/* Guardrail callout */}
      {currentStep.guardrailNote && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-2.5 text-[11px] text-zinc-300">
          <Shield className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
          <div className="leading-tight">
            <span className="font-semibold text-zinc-200">Guardrail: </span>
            {currentStep.guardrailNote}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-3.5 h-1 w-full bg-zinc-800/90 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${isLastStep ? 'bg-emerald-500' : 'bg-[#FF5722]'}`}
          style={{ width: `${stepProgress}%` }}
          transition={{ ease: 'linear' }}
        />
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1.5">
          <button
            onClick={prevStep}
            disabled={isFirstStep}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/80 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>

          {!isLastStep && (
            <button
              onClick={isPlaying ? pauseTour : resumeTour}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors flex items-center gap-1 cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3 h-3 text-amber-400" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-emerald-400" />
                  Resume
                </>
              )}
            </button>
          )}
        </div>

        <button
          data-tour="tooltip-next-btn"
          onClick={isLastStep ? exitTour : nextStep}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#FF5722] hover:bg-[#FF4500] shadow-[0_0_12px_rgba(255,87,34,0.35)] hover:shadow-[0_0_16px_rgba(255,87,34,0.55)] transition-all flex items-center gap-1 cursor-pointer"
        >
          {isLastStep ? 'Complete Tour' : 'Next'}
          {isLastStep ? <Check className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </motion.div>
  </AnimatePresence>
);
}
