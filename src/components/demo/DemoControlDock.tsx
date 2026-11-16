"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  X,
  Gauge,
  RefreshCw,
  LayoutGrid,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useTour } from '@/demo/tour-context';

export function DemoControlDock() {
  const {
    scenarios,
    activeScenario,
    currentStepIndex,
    isPlaying,
    playbackSpeed,
    startTour,
    pauseTour,
    resumeTour,
    nextStep,
    prevStep,
    skipScenario,
    replayScenario,
    exitTour,
    setSpeed,
    openLauncher,
    resetData,
  } = useTour();

  const [minimized, setMinimized] = useState(false);
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // If tour is not active, render floating widget styled exactly as requested
  if (!activeScenario) {
    return (
      <div className="fixed bottom-6 right-6 z-[9990] flex items-center">
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="inline-flex items-center gap-3 rounded-xl bg-[#161618] border border-[#3d261d] p-1 pl-3.5 pr-1 shadow-2xl shadow-black/80 backdrop-blur-xl"
        >
          {/* Green dot + Interactive Demo label */}
          <div
            onClick={openLauncher}
            className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity select-none"
            title="Explore Demo Scenarios"
          >
            <span className="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.8)] flex-shrink-0" />
            <span className="text-white font-semibold text-xs tracking-tight whitespace-nowrap">
              Interactive Demo
            </span>
          </div>

          {/* Orange Start Guided Tour button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => startTour()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#FF5722] hover:bg-[#FF4500] text-white font-bold text-xs tracking-tight shadow-[0_0_14px_rgba(255,87,34,0.45)] hover:shadow-[0_0_20px_rgba(255,87,34,0.65)] transition-all cursor-pointer"
          >
            <Play className="w-3 h-3 fill-white text-white flex-shrink-0" />
            <span className="whitespace-nowrap">Start Guided Tour</span>
          </motion.button>
        </motion.div>
      </div>
    );
  }

  const totalSteps = activeScenario.steps.length;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9995] pointer-events-auto">
      <motion.div
        layout
        className="rounded-2xl border border-gray-700/70 bg-gray-900/95 text-white shadow-2xl backdrop-blur-xl p-2.5 flex items-center gap-2"
      >
        {/* Scenario Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowScenarioMenu((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl bg-gray-800/80 hover:bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-200 hover:text-white border border-gray-700/60 transition-colors"
          >
            <span className="flex h-2 w-2 rounded-full bg-[#FF6633]" />
            <span className="max-w-[140px] truncate">{activeScenario.shortTitle}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          <AnimatePresence>
            {showScenarioMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-gray-700 bg-gray-900/95 shadow-xl backdrop-blur-xl p-1 z-50 overflow-hidden"
              >
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-800">
                  Select Workflow Scenario
                </div>
                <div className="py-1 max-h-60 overflow-y-auto">
                  {scenarios.map((scen, idx) => (
                    <button
                      key={scen.id}
                      onClick={() => {
                        startTour(scen.id, 0);
                        setShowScenarioMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between transition-colors ${
                        scen.id === activeScenario.id
                          ? 'bg-[#FF6633]/20 text-[#FF6633] font-semibold'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <span>
                        {idx + 1}. {scen.shortTitle}
                      </span>
                      <span className="text-[10px] text-gray-400">{scen.duration}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Step Counter */}
        <div className="hidden sm:flex items-center px-2 py-1 text-xs text-gray-400 border-l border-r border-gray-800">
          <span>
            Step <strong className="text-white">{currentStepIndex + 1}</strong> of {totalSteps}
          </span>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-1">
          {/* Previous Step */}
          <button
            onClick={prevStep}
            disabled={currentStepIndex === 0}
            title="Previous step"
            className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Play / Pause Toggle */}
          <button
            onClick={isPlaying ? pauseTour : resumeTour}
            title={isPlaying ? 'Pause tour (Space)' : 'Resume tour (Space)'}
            className="p-2.5 rounded-xl bg-[#FF6633] text-white hover:bg-[#E55A2B] shadow-sm transition-all"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
          </button>

          {/* Next Step */}
          <button
            onClick={nextStep}
            title="Next step"
            className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Replay Scenario */}
          <button
            onClick={replayScenario}
            title="Replay this scenario"
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Skip Scenario */}
          <button
            onClick={skipScenario}
            title="Skip to next scenario"
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="relative">
          <button
            onClick={() => setShowSpeedMenu((prev) => !prev)}
            title="Change walkthrough speed"
            className="flex items-center gap-1 rounded-xl bg-gray-800/80 hover:bg-gray-800 px-2.5 py-2 text-xs font-medium text-gray-300 hover:text-white border border-gray-700/60 transition-colors"
          >
            <Gauge className="w-3.5 h-3.5 text-gray-400" />
            <span>{playbackSpeed}x</span>
          </button>

          <AnimatePresence>
            {showSpeedMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-full right-0 mb-2 w-24 rounded-xl border border-gray-700 bg-gray-900/95 shadow-xl backdrop-blur-xl p-1 z-50"
              >
                {[0.75, 1, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => {
                      setSpeed(spd);
                      setShowSpeedMenu(false);
                    }}
                    className={`w-full text-center px-2 py-1 text-xs rounded-lg transition-colors ${
                      playbackSpeed === spd
                        ? 'bg-[#FF6633]/20 text-[#FF6633] font-semibold'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    {spd}x Speed
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Reset Demo Data Button */}
        <button
          onClick={resetData}
          title="Reset demo data to initial state"
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Open Scenario Hub */}
        <button
          onClick={openLauncher}
          title="Browse all scenarios"
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
        </button>

        {/* Exit Walkthrough Button */}
        <button
          onClick={exitTour}
          title="Exit walkthrough"
          className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors ml-1"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
}
