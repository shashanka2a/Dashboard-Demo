"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { DEMO_SCENARIOS, type TourScenario, type TourStep } from './scenarios';
import { demoStore } from '@/lib/demo-data';
import { toast } from 'sonner';

export interface CursorState {
  x: number;
  y: number;
  visible: boolean;
  clicking: boolean;
  text?: string;
}

interface TourContextValue {
  scenarios: TourScenario[];
  activeScenario: TourScenario | null;
  currentStepIndex: number;
  currentStep: TourStep | null;
  isPlaying: boolean;
  playbackSpeed: number;
  stepProgress: number; // 0 to 100%
  cursor: CursorState;
  targetRect: DOMRect | null;
  targetElement: HTMLElement | null;
  isLauncherOpen: boolean;
  startTour: (scenarioId?: string, stepIndex?: number) => void;
  pauseTour: () => void;
  resumeTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipScenario: () => void;
  replayScenario: () => void;
  exitTour: () => void;
  setSpeed: (speed: number) => void;
  openLauncher: () => void;
  closeLauncher: () => void;
  resetData: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

const DEFAULT_STEP_DURATION_MS = 6500;

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [stepProgress, setStepProgress] = useState<number>(0);
  const [cursor, setCursor] = useState<CursorState>({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
    visible: false,
    clicking: false,
  });
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [isLauncherOpen, setIsLauncherOpen] = useState<boolean>(false);

  const activeScenario = DEMO_SCENARIOS.find((s) => s.id === activeScenarioId) || null;
  const currentStep = activeScenario ? activeScenario.steps[currentStepIndex] || null : null;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stepStartTimeRef = useRef<number>(Date.now());
  const elapsedBeforePauseRef = useRef<number>(0);

  // ── Element locator with retry ──────────────────────────────────────────────
  const locateTarget = useCallback((step: TourStep): HTMLElement | null => {
    if (typeof document === 'undefined') return null;
    let el = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (!el && step.fallbackSelector) {
      el = document.querySelector(step.fallbackSelector) as HTMLElement | null;
    }
    return el;
  }, []);

  // ── Update target element rect ──────────────────────────────────────────────
  const updateRect = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      setTargetElement(null);
      return;
    }
    const el = locateTarget(currentStep);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      setTargetElement(el);
    } else {
      setTargetRect(null);
      setTargetElement(null);
    }
  }, [currentStep, locateTarget]);

  // Recalculate on resize/scroll
  useEffect(() => {
    if (!activeScenario) return;
    const handleRecalc = () => updateRect();
    window.addEventListener('resize', handleRecalc);
    window.addEventListener('scroll', handleRecalc, true);
    return () => {
      window.removeEventListener('resize', handleRecalc);
      window.removeEventListener('scroll', handleRecalc, true);
    };
  }, [activeScenario, updateRect]);

  // ── Execute Step Action (Gliding cursor, click, typing) ──────────────────────
  const executeStepAction = useCallback(
    (step: TourStep, el: HTMLElement | null) => {
      if (!el) {
        setCursor((prev) => ({ ...prev, visible: false }));
        return;
      }

      const rect = el.getBoundingClientRect();
      const targetX = rect.left + rect.width / 2;
      const targetY = rect.top + rect.height / 2;

      // Make cursor visible and glide to element
      setCursor({
        x: targetX,
        y: targetY,
        visible: true,
        clicking: false,
      });

      // Handle simulated click
      if (step.action === 'click') {
        setTimeout(() => {
          setCursor((prev) => ({ ...prev, clicking: true }));
          setTimeout(() => {
            setCursor((prev) => ({ ...prev, clicking: false }));
            // Trigger actual element click to drive UI forward
            try {
              el.click();
              el.focus();
            } catch {
              /* ignore */
            }
          }, 250);
        }, 700 / playbackSpeed);
      }

      // Handle simulated typing
      if (step.action === 'type' && step.typeText) {
        setTimeout(() => {
          setCursor((prev) => ({ ...prev, clicking: true }));
          setTimeout(() => {
            setCursor((prev) => ({ ...prev, clicking: false, text: 'Typing…' }));
            if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
              el.focus();
              let curText = '';
              const fullText = step.typeText!;
              const typeInterval = setInterval(() => {
                if (curText.length < fullText.length) {
                  curText = fullText.slice(0, curText.length + 1);
                  el.value = curText;
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                  clearInterval(typeInterval);
                  setCursor((prev) => ({ ...prev, text: undefined }));
                }
              }, 60 / playbackSpeed);
            }
          }, 300);
        }, 600 / playbackSpeed);
      }
    },
    [playbackSpeed]
  );

  // ── Step progression & navigation ──────────────────────────────────────────
  const exitTour = useCallback(() => {
    setIsPlaying(false);
    setActiveScenarioId(null);
    setCursor((prev) => ({ ...prev, visible: false }));
    setTargetRect(null);
    setTargetElement(null);
  }, []);

  const nextStep = useCallback(() => {
    if (!activeScenario) return;
    const nextIdx = currentStepIndex + 1;
    if (nextIdx < activeScenario.steps.length) {
      setCurrentStepIndex(nextIdx);
      setStepProgress(0);
      elapsedBeforePauseRef.current = 0;
    } else {
      // 12 steps complete! Cleanly exit walkthrough without chaining into other scenarios
      exitTour();
    }
}, [activeScenario, currentStepIndex, exitTour]);

const prevStep = useCallback(() => {
  if (currentStepIndex > 0) {
    setCurrentStepIndex((prev) => prev - 1);
    setStepProgress(0);
    elapsedBeforePauseRef.current = 0;
  }
}, [currentStepIndex]);

const pauseTour = useCallback(() => {
  setIsPlaying(false);
  elapsedBeforePauseRef.current += Date.now() - stepStartTimeRef.current;
  if (timerRef.current) clearTimeout(timerRef.current);
  if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
}, []);

const resumeTour = useCallback(() => {
  setIsPlaying(true);
  stepStartTimeRef.current = Date.now();
}, []);

const startTour = useCallback(
  (scenarioId?: string, stepIndex = 0) => {
    const targetId = scenarioId || activeScenarioId || DEMO_SCENARIOS[0].id;
    const scen = DEMO_SCENARIOS.find((s) => s.id === targetId) || DEMO_SCENARIOS[0];

    setActiveScenarioId(scen.id);
    setCurrentStepIndex(stepIndex);
    setIsPlaying(true);
    setStepProgress(0);
    elapsedBeforePauseRef.current = 0;
    setIsLauncherOpen(false);

    // Route check
    const firstStep = scen.steps[stepIndex];
    const targetRoute = firstStep?.route || scen.initialRoute;
    if (targetRoute && pathname !== targetRoute) {
      router.push(targetRoute);
    }
  },
  [activeScenarioId, pathname, router]
);

const skipScenario = useCallback(() => {
  if (!activeScenario) return;
  const currentScenIdx = DEMO_SCENARIOS.findIndex((s) => s.id === activeScenario.id);
  if (currentScenIdx < DEMO_SCENARIOS.length - 1) {
    const nextScen = DEMO_SCENARIOS[currentScenIdx + 1];
    setActiveScenarioId(nextScen.id);
    setCurrentStepIndex(0);
    setStepProgress(0);
    elapsedBeforePauseRef.current = 0;
    if (nextScen.initialRoute && pathname !== nextScen.initialRoute) {
      router.push(nextScen.initialRoute);
    }
  } else {
    setIsPlaying(false);
    setActiveScenarioId(null);
  }
}, [activeScenario, pathname, router]);

const replayScenario = useCallback(() => {
  if (!activeScenario) return;
  setCurrentStepIndex(0);
  setStepProgress(0);
  elapsedBeforePauseRef.current = 0;
  setIsPlaying(true);
  if (activeScenario.initialRoute && pathname !== activeScenario.initialRoute) {
    router.push(activeScenario.initialRoute);
  }
}, [activeScenario, pathname, router]);

const setSpeed = useCallback((spd: number) => {
  setPlaybackSpeed(spd);
}, []);

const resetData = useCallback(() => {
  demoStore.reset();
  toast.success('Demo data restored to initial state');
  router.refresh();
}, [router]);

// Check query parameters to launch tour automatically if requested
useEffect(() => {
  if (!searchParams) return;
  const tourParam = searchParams.get('tour');
  if (tourParam) {
    if (tourParam === 'start' || tourParam === 'all') {
      startTour(DEMO_SCENARIOS[0].id, 0);
    } else {
      const matching = DEMO_SCENARIOS.find((s) => s.id === tourParam);
      if (matching) {
        startTour(matching.id, 0);
      }
    }
  }
}, [searchParams, startTour]);
useEffect(() => {
  if (!activeScenario || !currentStep) return;

  // Check if step requires navigation
  if (currentStep.route && pathname !== currentStep.route.split('?')[0]) {
    router.push(currentStep.route);
  }

  // If it's the final step ("Tour Complete"), center modal and hide cursor
  const isLastStep = currentStepIndex === activeScenario.steps.length - 1;
  if (isLastStep || !currentStep.targetSelector) {
    setTargetRect(null);
    setTargetElement(null);
    setCursor((prev) => ({ ...prev, visible: false }));
    return;
  }

  // Try finding element immediately, and with small retries after route change/render
  let attempts = 0;
  const checkElement = () => {
    const el = locateTarget(currentStep);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      setTargetElement(el);
      executeStepAction(currentStep, el);
    } else if (attempts < 10) {
      attempts++;
      setTimeout(checkElement, 250);
    } else {
      // Fallback to center spotlight if element not found
      setTargetRect(null);
      setTargetElement(null);
    }
  };

  checkElement();
}, [activeScenario, currentStep, currentStepIndex, locateTarget, executeStepAction, pathname, router]);

// Global keyboard shortcuts (Space: pause/resume, Arrows: next/prev, Esc: exit)
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    ) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (activeScenario) {
        if (isPlaying) pauseTour();
        else resumeTour();
      }
    } else if (e.code === 'ArrowRight') {
      if (activeScenario) nextStep();
    } else if (e.code === 'ArrowLeft') {
      if (activeScenario) prevStep();
    } else if (e.code === 'Escape') {
      if (isLauncherOpen) setIsLauncherOpen(false);
      else if (activeScenario) exitTour();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [activeScenario, isPlaying, isLauncherOpen, pauseTour, resumeTour, nextStep, prevStep, exitTour]);

// ── Auto-advance timer ──────────────────────────────────────────────────────
useEffect(() => {
    const isLastStep = activeScenario && currentStepIndex === activeScenario.steps.length - 1;
    if (!isPlaying || !activeScenario || !currentStep || isLastStep) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (isLastStep) setStepProgress(100);
      return;
    }

    stepStartTimeRef.current = Date.now();
    const totalDuration = DEFAULT_STEP_DURATION_MS / playbackSpeed;
    const remainingDuration = Math.max(0, totalDuration - elapsedBeforePauseRef.current);

    // Update progress bar
    progressIntervalRef.current = setInterval(() => {
      const elapsed = elapsedBeforePauseRef.current + (Date.now() - stepStartTimeRef.current);
      const pct = Math.min(100, Math.round((elapsed / totalDuration) * 100));
      setStepProgress(pct);
    }, 50);

    // Auto-advance step
    timerRef.current = setTimeout(() => {
      elapsedBeforePauseRef.current = 0;
      nextStep();
    }, remainingDuration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, activeScenario, currentStep, currentStepIndex, playbackSpeed, nextStep]);

return (
  <TourContext.Provider
    value={{
      scenarios: DEMO_SCENARIOS,
      activeScenario,
      currentStepIndex,
      currentStep,
      isPlaying,
      playbackSpeed,
      stepProgress,
      cursor,
      targetRect,
      targetElement,
      isLauncherOpen,
      startTour,
      pauseTour,
      resumeTour,
      nextStep,
      prevStep,
      skipScenario,
      replayScenario,
      exitTour,
      setSpeed,
      openLauncher: () => setIsLauncherOpen(true),
      closeLauncher: () => setIsLauncherOpen(false),
      resetData,
    }}
  >
    {children}
  </TourContext.Provider>
);
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return ctx;
}
