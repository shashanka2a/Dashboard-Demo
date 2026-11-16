"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  BarChart3,
  FolderOpen,
  FileText,
  AlertTriangle,
  Users,
  Building2,
  Clock,
  Play,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { setDemoSuperuserSession } from "@/lib/demo-auth";
import { DEMO_SCENARIOS } from "@/demo/scenarios";

const ICONS: Record<string, React.ElementType> = {
  BarChart3,
  FolderOpen,
  FileText,
  AlertTriangle,
  Users,
  Building2,
};

export default function HomePage() {
  const router = useRouter();

  const handleLaunchTour = (scenarioId?: string) => {
    setDemoSuperuserSession();
    if (scenarioId) {
      router.push(`/activity?tour=${scenarioId}`);
    } else {
      router.push("/activity?tour=start");
    }
  };

  const handleEnterDashboard = () => {
    setDemoSuperuserSession();
    router.push("/activity");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-[#FF6633] selection:text-white overflow-x-hidden">
      {/* Background radial gradient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#FF6633]/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-orange-600/10 rounded-full blur-[140px]" />
      </div>

      {/* Navigation bar */}
      <nav className="relative z-20 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={36} roundedClassName="rounded-xl" />
            <div>
              <span className="text-xs uppercase tracking-widest text-[#FF6633] font-bold">Utility Vision</span>
              <h1 className="text-base font-bold text-white leading-none">Operations Dashboard</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-xl hover:bg-slate-800/60 transition-colors"
            >
              Sign In
            </Link>
            <button
              onClick={() => handleLaunchTour()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6633] to-[#FF8C66] text-xs font-bold text-white shadow-lg shadow-orange-500/20 hover:brightness-105 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Take a Tour
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 pb-20 px-6 max-w-6xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FF6633]/10 border border-[#FF6633]/30 text-xs font-semibold text-[#FF8C66] mb-6 shadow-sm"
        >
          <Sparkles className="w-4 h-4 text-[#FF6633]" />
          <span>Interactive Product Demo & Guided Walkthrough</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight"
        >
          Modern Infrastructure Telemetry &{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6633] via-orange-400 to-amber-300">
            Field Operations
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed"
        >
          Utility-scale vegetation management, environmental compliance, digital daily sign-offs, and isolated client portals built for heavy environmental contractors.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-4"
        >
          <button
            onClick={() => handleLaunchTour()}
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-[#FF6633] to-[#FF8C66] text-sm font-bold text-white shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Play className="w-4 h-4 fill-white" />
            Explore Interactive Demo
          </button>

          <button
            onClick={handleEnterDashboard}
            className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-sm font-semibold text-slate-200 hover:text-white border border-slate-800 shadow-md transition-all"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            Enter Live Dashboard
          </button>
        </motion.div>

        {/* Live Metrics Ticker Banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-3xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl shadow-2xl"
        >
          <div className="p-3 text-center border-r border-slate-800/50 last:border-none">
            <div className="text-2xl sm:text-3xl font-extrabold text-white">6</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Active Utility Corridors</div>
          </div>
          <div className="p-3 text-center border-r border-slate-800/50 last:border-none">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#FF6633]">1,342.5</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Acres Cleared & Treated</div>
          </div>
          <div className="p-3 text-center border-r border-slate-800/50 last:border-none">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">100%</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Superintendent Sign-Off</div>
          </div>
          <div className="p-3 text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-400">0</div>
            <div className="text-xs text-slate-400 font-medium mt-1">OSHA Recordables</div>
          </div>
        </motion.div>
      </section>

      {/* Guided Walkthrough Scenarios Grid */}
      <section className="relative z-10 py-16 px-6 max-w-7xl mx-auto border-t border-slate-800/60">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#FF6633]">6 Interactive Scenarios</span>
          <h3 className="text-3xl font-bold text-white mt-1.5">
            Experience Key Workflows in Action
          </h3>
          <p className="text-sm text-slate-400 mt-2">
            Each scenario simulates real user interactions, mouse movements, form submissions, and guardrail validations derived directly from the application codebase.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DEMO_SCENARIOS.map((scen, idx) => {
            const IconComponent = ICONS[scen.iconName] || BarChart3;
            return (
              <motion.div
                key={scen.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="rounded-3xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700/80 p-6 flex flex-col justify-between shadow-xl transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-[#FF6633] group-hover:bg-[#FF6633] group-hover:text-white transition-colors shadow-sm">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full">
                        <Clock className="w-3 h-3" />
                        {scen.duration}
                      </span>
                      <span className="text-[11px] font-bold text-[#FF8C66] bg-[#FF6633]/15 border border-[#FF6633]/30 px-2.5 py-1 rounded-full">
                        {scen.badge}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Scenario 0{idx + 1}
                  </span>
                  <h4 className="text-lg font-bold text-white mt-1 mb-2 group-hover:text-orange-400 transition-colors">
                    {scen.title}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    {scen.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    {scen.steps.length} interactive steps
                  </span>
                  <button
                    onClick={() => handleLaunchTour(scen.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-[#FF6633] text-xs font-semibold text-white transition-colors group-hover:bg-[#FF6633]"
                  >
                    <span>Start Tour</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Enterprise Guardrails Section */}
      <section className="relative z-10 py-16 px-6 max-w-6xl mx-auto border-t border-slate-800/60">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 sm:p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#FF6633]">Safety & Data Integrity</span>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1 mb-3">
                Built-In Validations & Guardrails
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Utility Vision protects client confidentiality, NERC reliability compliance, and OSHA worker safety standards through rigid architectural boundaries.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span><strong>Client Portal Firewall:</strong> Isolated subdomain access with project-scoped token permissions.</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span><strong>Tamper-Proof Audit Chain:</strong> Digitally signed daily reports lock field data permanently.</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span><strong>OSHA Investigation Workflow:</strong> Enforced medical clearance prior to incident closeout.</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <ShieldCheck className="w-4 h-4 text-[#FF6633]" />
                Demo Isolation Guarantee
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                This demo runs entirely within a secure simulated environment. Feel free to create test projects, toggle portal settings, invite team members, and resolve safety incidents. Production data and live credentials are never contacted.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => handleLaunchTour()}
                  className="w-full py-2.5 rounded-xl bg-[#FF6633] text-white text-xs font-bold hover:bg-[#E55A2B] transition-colors"
                >
                  Launch Full Interactive Walkthrough
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 py-8 px-6 text-center text-xs text-slate-500">
        <p>© 2026 Utility Vision Dashboard &bull; High-Performance Infrastructure & Field Operations Software</p>
      </footer>
    </div>
  );
}
