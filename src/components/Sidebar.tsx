"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import {
  BarChart3, FileText, TrendingUp, Calendar, LayoutDashboard,
  Briefcase, Building2, ChevronDown, Users, Image, Settings,
  Shield, Info, ClipboardList, ChevronRight,
  FolderOpen,   CloudRain, BookOpen, Clock3, CalendarCheck, Sun, Cloud, FlaskConical,
  AlertTriangle, StickyNote, Ruler, Eye,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { WeatherModal } from "./WeatherModal";
import { AppLogo } from "./AppLogo";
import { format } from "date-fns";
import { readDashboardCache, writeDashboardCache, PROJECTS_RAW_CACHE_KEY } from "@/lib/dashboard-data-cache";
import { prefetchActivityBootstrap } from "@/lib/prefetch-activity-bootstrap";
import { prefetchReportsBootstrap } from "@/lib/prefetch-reports-bootstrap";
import { UserAccountMenu } from "@/components/UserAccountMenu";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ProjectOption { id: string; name: string; }

// ─── Main icon-rail nav ────────────────────────────────────────────────────────
const MAIN_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/activity" },
  { id: "projects",  label: "Projects",  icon: FolderOpen,      path: "/projects" },
  { id: "directory", label: "Directory", icon: Users,            path: "/directory" },
  { id: "clients",   label: "Clients",   icon: Building2,        path: "/clients" },
  { id: "company",   label: "Company",   icon: Settings,         path: "/company" },
] as const;

// ─── Which main-nav icon is active ─────────────────────────────────────────────
function getActiveSection(pathname: string) {
  if (["/activity", "/reports", "/jsa-reports", "/insights", "/incidents", "/observations", "/daily-logs", "/live-views"].some(p => pathname.startsWith(p))) return "dashboard";
  if (pathname.startsWith("/projects"))  return "projects";
  if (pathname.startsWith("/directory")) return "directory";
  if (pathname.startsWith("/clients"))   return "clients";
  if (pathname.startsWith("/company"))   return "company";
  return "dashboard";
}

// ─── Dashboard sub-nav (ALWAYS Activity / Reports / Insights) ──────────────────
// NOTE: This is completely independent of project selection. Never changes.
function DashboardSubNav({ pathname }: { pathname: string }) {
  const NAV = [
    { label: "Activity", icon: BarChart3, path: "/activity" },
    { label: "Reports",  icon: FileText,  path: "/reports" },
    { label: "JSA Reports", icon: Shield, path: "/jsa-reports" },
    { label: "Incidents", icon: AlertTriangle, path: "/incidents" },
    { label: "Observations", icon: Eye, path: "/observations" },
    { label: "Insights", icon: TrendingUp, path: "/insights/summary" },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-5 border-b border-gray-100 mb-2">
        <h2 className="text-xl font-bold text-gray-800 tracking-tight">Dashboard</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-3 space-y-0.5 pt-2">
        {NAV.map((item) => {
          const isActive = pathname.startsWith(item.path);
          const tourId =
            item.path === "/activity"
              ? "sidebar-dashboard-activity"
              : item.path === "/reports"
                ? "sidebar-dashboard-reports"
                : item.path === "/jsa-reports"
                  ? "sidebar-dashboard-jsa"
                  : item.path === "/incidents"
                    ? "sidebar-dashboard-incidents"
                    : item.path === "/observations"
                      ? "sidebar-dashboard-observations"
                      : item.path === "/insights/summary"
                        ? "sidebar-dashboard-insights"
                        : undefined;

          return (
            <Link
              key={item.label}
              href={item.path}
              data-tour={tourId}
              onMouseEnter={
                item.path === "/activity"
                  ? () => prefetchActivityBootstrap()
                  : item.path === "/reports"
                    ? () => prefetchReportsBootstrap()
                    : undefined
              }
              className={`flex items-center gap-3 px-3.5 py-2.5 text-[15px] rounded-lg transition-all mb-0.5 focus:outline-none ${
                isActive ? "text-[#2196F3] font-semibold bg-[#2196F3]/5" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-[#2196F3]" : "text-gray-400"}`} strokeWidth={1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Project detail sub-nav (ONLY shown on /projects/dashboard) ────────────────
const PROJECT_NAV = [
  {
    label: "Dashboard", icon: LayoutDashboard,
    children: [
      { label: "Activity",  view: "activity" },
      { label: "Reports",   view: "reports" },
      { label: "Observations", view: "observations" },
      { label: "Summary",   view: "project-insights" },
    ],
  },
  {
    label: "Daily logs", icon: Calendar,
    children: [
      { label: "Metrics",     view: "metrics" },
      { label: "Chemicals",   view: "chemicals" },
      { label: "Notes",       view: "notes" },
      { label: "Attachments", view: "attachments" },
      { label: "Survey",      view: "survey" },
    ],
  },
  {
    label: "Safety & QC", icon: Briefcase,
    children: [
      { label: "Checklists",    view: "checklists" },
      { label: "JSA & Pre-Brief", view: "jsa" },
      { label: "Safety talks",  view: "safety-talks" },
      { label: "Incidents",     view: "incidents" },
    ],
  },
  { label: "Schedule",  icon: CalendarCheck, view: "schedule" },
  { label: "Directory", icon: Users,    view: "directory" },
  { label: "Gallery",   icon: Image,    view: "gallery" },
  { label: "Settings",  icon: Settings, view: "settings" },
];

function ProjectSubNav({ currentView }: { currentView: string }) {
  const { selectedProject, selectedDate, setSelectedDate } = useProject();
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);
  const [projectAddress, setProjectAddress] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [sidebarWeather, setSidebarWeather] = useState<{ high: number; low: number; code: number } | null>(null);

  useEffect(() => {
    if (!zipCode || !selectedDate) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const isHistorical = new Date(dateStr) < new Date(new Date().toDateString());
    const endpoint = isHistorical 
      ? `https://archive-api.open-meteo.com/v1/archive`
      : `https://api.open-meteo.com/v1/forecast`;

    // 1. First get lat/long for zip
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${zipCode}&count=1`)
      .then(r => r.json())
      .then(geo => {
        if (geo.results?.[0]) {
          const { latitude, longitude } = geo.results[0];
          return fetch(`${endpoint}?latitude=${latitude}&longitude=${longitude}&start_date=${dateStr}&end_date=${dateStr}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&temperature_unit=fahrenheit`);
        }
      })
      .then(r => r?.json())
      .then(data => {
        if (data?.daily) {
          setSidebarWeather({
            high: Math.round(data.daily.temperature_2m_max[0]),
            low: Math.round(data.daily.temperature_2m_min[0]),
            code: data.daily.weather_code[0]
          });
        }
      })
      .catch(console.error);
  }, [zipCode, selectedDate]);

  useEffect(() => {
    if (selectedProject && selectedProject !== "All Projects") {
      const raw = readDashboardCache<any[]>(PROJECTS_RAW_CACHE_KEY);
      const fromCache = raw?.find((p) => p.name === selectedProject);
      if (fromCache) {
        const addr = [fromCache.city, fromCache.state, fromCache.country].filter(Boolean).join(', ');
        setProjectAddress(addr || "Location not set");
        setZipCode(fromCache.zip_code || "");
      }
      const ac = new AbortController();
      fetch(`/api/projects`, { signal: ac.signal })
        .then((res) => res.json())
        .then((projects: any[]) => {
          if (ac.signal.aborted) return;
          if (Array.isArray(projects)) writeDashboardCache(PROJECTS_RAW_CACHE_KEY, projects);
          const project = projects.find((p: any) => p.name === selectedProject);
          if (project) {
            const addr = [project.city, project.state, project.country].filter(Boolean).join(', ');
            setProjectAddress(addr || "Location not set");
            setZipCode(project.zip_code || "");
          }
        });
      return () => ac.abort();
    }
  }, [selectedProject]);
  
  // Start with only the group containing the active view being open
  const defaultOpen = PROJECT_NAV.find(group => 
    group.children?.some(c => ('view' in c ? c.view : null) === currentView)
  )?.label ?? "Dashboard";

  const [openGroups, setOpenGroups] = useState<string[]>([defaultOpen]);
  const toggle = (label: string) =>
    setOpenGroups(prev => prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]);

  /** Keep the section that contains the current view expanded so the active item stays visible and styled. */
  useEffect(() => {
    const v = (currentView || "activity").trim();
    const label = PROJECT_NAV.find((item) =>
      item.children?.some((c) => "view" in c && c.view === v)
    )?.label;
    if (label) {
      setOpenGroups((prev) => (prev.includes(label) ? prev : [...prev, label]));
    }
  }, [currentView]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white">      {/* Weather widget */}
      <div className="px-4 pt-4 pb-3">
        <button 
          onClick={() => setIsWeatherOpen(true)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3 hover:bg-gray-100 hover:border-gray-300 transition-all text-left group/weather"
        >
          <div className="bg-blue-50 p-2 rounded-lg group-hover/weather:bg-blue-100 transition-colors">
            {sidebarWeather?.code !== undefined && sidebarWeather.code >= 51 ? (
              <CloudRain className="w-6 h-6 text-blue-500 flex-shrink-0" />
            ) : sidebarWeather?.code !== undefined && sidebarWeather.code <= 3 ? (
              <Sun className="w-6 h-6 text-yellow-500 flex-shrink-0" />
            ) : (
              <CloudRain className="w-6 h-6 text-blue-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex-1">
            <div className="text-gray-900 font-bold text-base leading-none">
              {sidebarWeather ? `${sidebarWeather.high}°` : "—"}
              <span className="text-gray-400 font-normal ml-0.5">/{sidebarWeather ? `${sidebarWeather.low}°` : "—"}</span>
            </div>
            <div className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-wider">
              {sidebarWeather?.code !== undefined && sidebarWeather.code >= 51 ? "Rain expected" :
               sidebarWeather?.code !== undefined && sidebarWeather.code === 0 ? "Clear skies" :
               sidebarWeather ? "Partly Cloudy" : "Fetching weather..."}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover/weather:text-gray-500 transition-all" />
        </button>
      </div>

      <WeatherModal 
        isOpen={isWeatherOpen}
        onClose={() => setIsWeatherOpen(false)}
        projectName={selectedProject}
        projectAddress={projectAddress}
        zipCode={zipCode}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {PROJECT_NAV.map((item) => {
          const isGroup = !!item.children;
          const isOpen = openGroups.includes(item.label);
          const itemView = 'view' in item ? item.view : null;

          const viewKey = currentView || 'activity';
          const isActiveGroup = item.children?.some((c) => ('view' in c ? c.view : null) === viewKey);
          const isActive = itemView === viewKey;

          if (isGroup) {
            return (
              <div key={item.label} className="mb-1">
                <button
                  onClick={() => toggle(item.label)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-[15px] rounded-lg transition-all focus:outline-none ${
                    isActiveGroup ? "text-[#2196F3] bg-[#2196F3]/5 font-semibold" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 ${isActiveGroup ? "text-[#2196F3]" : "text-gray-400"}`} strokeWidth={1.5} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </button>
                {isOpen && (
                  <div className="mt-0.5 space-y-0.5">
                    {item.children?.map(child => {
                      const childView = 'view' in child ? child.view : '';
                      const isChildActive = childView === (currentView || 'activity');
                      return (
                        <Link
                          key={child.label}
                          href={`/projects/dashboard?project=${encodeURIComponent(selectedProject)}&view=${childView}`}
                          className={`block py-2 pr-4 text-[14px] rounded-lg transition-all duration-200 ease-out ${
                            isChildActive
                              ? 'ml-8 pl-4 font-semibold text-[#1565C0] bg-[#E3F2FD] ring-1 ring-[#2196F3]/35 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 ml-11 pl-0'
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={`/projects/dashboard?project=${encodeURIComponent(selectedProject)}&view=${itemView}`}
              className={`flex items-center gap-3 px-3.5 py-2.5 text-[15px] rounded-lg transition-all mb-0.5 focus:outline-none ${
                isActive ? "text-[#2196F3] font-semibold bg-[#2196F3]/5" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-[#2196F3]" : "text-gray-400"}`} strokeWidth={1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Company sub-nav ───────────────────────────────────────────────────────────
function CompanySubNav({ pathname }: { pathname: string }) {
  const [safetyOpen, setSafetyOpen] = useState(pathname.startsWith("/company/safety"));

  const COMPANY_NAV = [
    { label: "Company info",        icon: Info,          path: "/company" },
    { label: "Roles & permissions", icon: Shield,        path: "/company/roles" },
    { label: "Project templates",   icon: ClipboardList, path: "/company/templates" },
    { label: "Chemical names",      icon: FlaskConical,  path: "/company/chemicals" },
    { label: "Note categories",     icon: StickyNote,    path: "/company/note-categories" },
    { label: "JSA form settings",   icon: Shield,        path: "/company/jsa-settings" },
    { label: "Photo tags",          icon: Image,         path: "/company/photo-tags" },
    { label: "Custom metrics",      icon: Ruler,         path: "/company/metrics" },
    { label: "Survey questions",    icon: ClipboardList, path: "/company/survey-questions" },
    {
      label: "Safety talks", icon: BookOpen, path: "/company/safety",
      children: [
        { label: "Library",      path: "/company/safety/library",   icon: BookOpen },
        { label: "Past talks",   path: "/company/safety/past",      icon: Clock3 },
        { label: "Upcoming",     path: "/company/safety/upcoming",  icon: CalendarCheck },
      ],
    },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-5 border-b border-gray-100 mb-4">
        <h2 className="text-xl font-bold text-gray-800 tracking-tight">Company</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {COMPANY_NAV.map((item) => {
          const isActive = pathname === item.path || (item.children?.some(c => pathname.startsWith(c.path)));
          if (item.children) {
            return (
              <div key={item.label}>
                <button
                  onClick={() => setSafetyOpen(!safetyOpen)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-[15px] rounded-lg transition-all ${
                    isActive ? "text-[#2196F3] bg-[#2196F3]/5 font-semibold" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <item.icon className="w-4 h-4" strokeWidth={1.5} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {safetyOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {safetyOpen && (
                  <div className="ml-9 mt-1 space-y-0.5">
                    {item.children.map(child => (
                      <Link
                        key={child.path}
                        href={child.path}
                        className={`flex items-center gap-2 px-3 py-2 text-[15px] rounded-lg transition-colors ${
                          pathname === child.path ? "text-[#2196F3] font-semibold bg-[#2196F3]/5" : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <child.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                        <span>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <Link
              key={item.label}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 text-[15px] rounded-lg transition-all ${
                pathname === item.path ? "text-[#2196F3] bg-[#2196F3]/5 font-semibold" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <item.icon className={`w-4 h-4 ${pathname === item.path ? "text-[#2196F3]" : ""}`} strokeWidth={1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Project selector dropdown (used inside the project detail view header) ─────
function ProjectSelectorDropdown() {
  const router = useRouter();
  const { selectedProject, setSelectedProject } = useProject();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  useLayoutEffect(() => {
    const raw = readDashboardCache<ProjectOption[]>(PROJECTS_RAW_CACHE_KEY);
    if (Array.isArray(raw) && raw.length) setProjects(raw);
    const ac = new AbortController();
    fetch('/api/projects', { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        if (ac.signal.aborted) return;
        if (Array.isArray(data)) {
          writeDashboardCache(PROJECTS_RAW_CACHE_KEY, data);
          setProjects(data);
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  const select = (name: string) => {
    setSelectedProject(name);
    setOpen(false);
    // Explicitly navigate to dashboard with newly selected project context
    router.push(`/projects/dashboard?project=${encodeURIComponent(name)}&view=activity`);
  };

  return (
    <div className="px-4 pt-4 pb-2 relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full bg-white border border-gray-300 hover:border-gray-400 px-4 py-2.5 rounded-lg text-[15px] text-left flex items-center justify-between transition-colors focus:outline-none"
      >
        <span className="text-gray-900 truncate font-semibold">{selectedProject}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-4 right-4 mt-1 bg-white rounded-lg shadow-lg z-20 border border-gray-100 py-1 max-h-[300px] overflow-y-auto">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => select(p.name)}
              className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
                selectedProject === p.name ? "text-[#2196F3] font-medium bg-[#2196F3]/5" : "text-gray-600"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Sidebar export ───────────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSection = getActiveSection(pathname);

  const isProjectDetail = pathname.startsWith("/projects/dashboard");
  const currentView = (searchParams?.get("view") ?? "activity").trim().toLowerCase() || "activity";

  return (
    <aside className="flex h-full flex-shrink-0">
      {/* ── Icon rail ── */}
      <div className="w-20 bg-gray-900 flex flex-col items-center py-6 gap-6 relative">
        <div className="mb-6 flex-shrink-0 shadow-lg shadow-orange-500/10">
          <AppLogo size={48} priority />
        </div>

        {MAIN_NAV.map(({ id, label, icon: Icon, path }) => {
          const isActive = activeSection === id;
          return (
            <Link
              key={id}
              href={path}
              data-tour={`nav-${id}`}
              prefetch={id === "dashboard"}
              onMouseEnter={id === "dashboard" ? () => prefetchActivityBootstrap() : undefined}
              title={label}
              className={`flex flex-col items-center gap-1.5 w-16 py-3 rounded-xl transition-all ${
                isActive ? "bg-gray-700/80 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "fill-white/10" : "fill-current/5"}`} strokeWidth={1.5} />
              <span className="text-[10px] font-semibold leading-none">{label}</span>
            </Link>
          );
        })}

        <div className="flex-1" />

        <UserAccountMenu />
      </div>

      {/* ── Sub-nav panel: one of three, mutually exclusive ── */}

      {/* 1. Dashboard (Activity/Reports/Insights) — only when on /activity* etc. */}
      {activeSection === "dashboard" && <DashboardSubNav pathname={pathname} />}

      {/* 2. Project detail — only when on /projects/dashboard route */}
      {isProjectDetail && (
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <ProjectSelectorDropdown />
          <ProjectSubNav currentView={currentView} />
        </div>
      )}

      {/* 3. Company */}
      {activeSection === "company" && <CompanySubNav pathname={pathname} />}
    </aside>
  );
}
