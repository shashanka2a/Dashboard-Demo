"use client";

import React from 'react';
import { Compass, RotateCcw } from 'lucide-react';
import { useTour } from '@/demo/tour-context';

export function DemoHeaderPill() {
  const { openLauncher, resetData, activeScenario } = useTour();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={openLauncher}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-[#FF6633] text-xs font-semibold hover:bg-orange-100 transition-colors shadow-sm"
        title="Explore Demo Scenarios"
      >
        <Compass className="w-3.5 h-3.5" />
        <span>Interactive Demo</span>
        {activeScenario && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
        )}
      </button>

      {/* Quick Reset */}
      <button
        onClick={resetData}
        title="Reset demo data"
        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

