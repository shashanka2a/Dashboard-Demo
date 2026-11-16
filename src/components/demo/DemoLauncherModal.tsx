"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  BarChart3,
  FolderOpen,
  FileText,
  AlertTriangle,
  Users,
  Building2,
  Clock,
  Compass,
  ShieldCheck,
  RotateCcw,
  LayoutDashboard,
} from 'lucide-react';
import { useTour } from '@/demo/tour-context';

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard,
  BarChart3,
  FolderOpen,
  FileText,
  AlertTriangle,
  Users,
  Building2,
};

export function DemoLauncherModal() {
  const { scenarios, isLauncherOpen, closeLauncher, startTour, resetData } = useTour();

  if (!isLauncherOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeLauncher}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-4xl rounded-3xl border border-gray-800 bg-gray-900 text-white shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#FF5722] to-[#FF7043] shadow-lg shadow-orange-500/20">
                <Compass className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">Interactive Product Tour</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Select a workflow scenario to launch an automated guided walkthrough with spotlight animation.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={resetData}
                title="Reset demo data"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-700 bg-gray-800/60 hover:bg-gray-800 text-xs font-medium text-gray-300 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Data
              </button>
              <button
                onClick={closeLauncher}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scenarios Grid */}
          <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            {scenarios.map((scen, idx) => {
              const IconComponent = ICONS[scen.iconName] || BarChart3;
              return (
                <div
                  key={scen.id}
                  className="group relative rounded-2xl border border-gray-800 bg-gray-800/40 hover:bg-gray-800/90 hover:border-gray-700 p-5 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-700/60 text-[#FF6633] group-hover:bg-[#FF6633] group-hover:text-white transition-colors">
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Scenario 0{idx + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-700/50 text-gray-300">
                          <Clock className="w-2.5 h-2.5" />
                          {scen.duration}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF6633]/20 text-[#FF6633] border border-[#FF6633]/30">
                          {scen.badge}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <h4 className="text-base font-bold text-white mb-1.5 group-hover:text-orange-400 transition-colors">
                      {scen.title}
                    </h4>

                    {/* Description */}
                    <p className="text-xs text-gray-400 leading-relaxed mb-4">
                      {scen.description}
                    </p>
                  </div>

                  {/* Launch button */}
                  <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 font-medium">
                      {scen.steps.length} guided interaction steps
                    </span>
                    <button
                      onClick={() => startTour(scen.id, 0)}
                      className="flex items-center gap-1.5 rounded-xl bg-gray-700/80 hover:bg-[#FF6633] px-3.5 py-1.5 text-xs font-semibold text-white transition-all shadow-sm group-hover:bg-[#FF6633]"
                    >
                      <Play className="w-3 h-3 fill-white" />
                      Launch Walkthrough
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-950/60 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Safe Sandbox: No production credentials or customer records are modified.</span>
            </div>
            <button
              onClick={() => startTour(scenarios[0].id, 0)}
              className="text-xs font-semibold text-[#FF6633] hover:underline"
            >
              Start Complete Tour (All 6 Scenarios) →
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
