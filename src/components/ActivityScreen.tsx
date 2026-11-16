"use client";

import { Calendar, SlidersHorizontal, Search, LayoutGrid, X, Loader2, ChevronDown } from 'lucide-react';
import { ActivityCard } from './ActivityCard';
import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useProject } from '@/context/ProjectContext';
import { getActivityDisplayTimeZone, formatYmdInTimeZone } from '@/lib/activity-display-timezone';
import {
  ACTIVITY_FEED_STALE_MS,
  ACTIVITY_FEED_CACHE_VERSION,
  getActivityFeedSnapshot,
  setActivityFeedSnapshot,
} from '@/lib/activity-feed-client-cache';
import { ActivityPageSkeleton } from '@/components/ActivityPageSkeleton';
import { writeDashboardCache, PROJECTS_RAW_CACHE_KEY } from '@/lib/dashboard-data-cache';
import {
  filterActivitiesForMainDashboard,
  filterProjectNamesForMainDashboard,
  isExcludedFromMainDashboard,
} from '@/lib/activity-excluded-projects';



// ─── Types ──────────────────────────────────────────────────────────────────

export interface Activity {
  id: string;
  employeeName: string;
  action: string;
  project: string;
  activityType: string;
  timestamp: string;
  /** When the row was submitted (maps to DB `logged_at` for field data). */
  isoTimestamp: string;
  /** Work/report day (YYYY-MM-DD) when present — prefer over isoTimestamp for date filters. */
  reportDateYmd?: string | null;
  metrics: { label: string; value: string; unit: string; highlight?: boolean; id?: string }[];
  photos: string[];
  /** YYYY-MM-DD when the row was submitted (attachments API). */
  submittedDateYmd?: string;
  /** YYYY-MM-DD work/calendar day chosen in the field app (attachments API). */
  selectedDateYmd?: string;
}


interface Filters {
  projects: string[];
  members: string[];
  activityTypes: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ACTIVITY_TYPES = [
  'Notes', 'Chemicals', 'Metrics', 'Survey', 'Checklists',
  'Attachments', 'Observations', 'Incidents', 'Safety Talks', 'Reports', 'Activity',
];

// ─── Removed mockActivity array in favor of DB fetch ────────────────────────



// ─── Multi-select pill component ─────────────────────────────────────────────

function MultiSelect({
  label, placeholder, options, selected, onChange, searchable = false,
}: {
  label: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = searchable
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent transition-all"
      >
        <span className={selected.length ? 'text-gray-900' : 'text-gray-400'}>
          {selected.length === 0
            ? placeholder
            : selected.length === 1
            ? selected[0]
            : `${selected.length} selected`}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-56 overflow-hidden flex flex-col">
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#FF6633]"
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">No options found</p>
            ) : filtered.map(opt => (
              <label key={opt} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="w-4 h-4 text-[#FF6633] border-gray-300 rounded focus:ring-[#FF6633]"
                />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Selected pills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map(s => (
            <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFE5DC] text-[#E55A2B] rounded-full text-xs font-medium">
              {s}
              <button type="button" onClick={() => toggle(s)} className="hover:text-[#FF6633] focus:outline-none">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filters Modal ────────────────────────────────────────────────────────────

function FiltersModal({
  isOpen, onClose, applied, onApply, projectOptions, memberOptions,
}: {
  isOpen: boolean;
  onClose: () => void;
  applied: Filters;
  onApply: (f: Filters) => void;
  projectOptions: string[];
  memberOptions: string[];
}) {
  const [draft, setDraft] = useState<Filters>(applied);

  // Sync when modal opens
  useEffect(() => { if (isOpen) setDraft(applied); }, [isOpen, applied]);

  if (!isOpen) return null;

  const activeCount = draft.projects.length + draft.members.length + draft.activityTypes.length;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Row 1: Project + Member */}
          <div className="grid grid-cols-2 gap-4">
            <MultiSelect
              label="Project"
              placeholder="Select projects"
              options={projectOptions}
              selected={draft.projects}
              onChange={v => setDraft(d => ({ ...d, projects: v }))}
              searchable
            />
            <MultiSelect
              label="Member"
              placeholder="Search members"
              options={memberOptions}
              selected={draft.members}
              onChange={v => setDraft(d => ({ ...d, members: v }))}
              searchable
            />
          </div>

          {/* Row 2: Activity type */}
          <MultiSelect
            label="Activity type"
            placeholder="Activity type"
            options={ACTIVITY_TYPES}
            selected={draft.activityTypes}
            onChange={v => setDraft(d => ({ ...d, activityTypes: v }))}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={() => setDraft({ projects: [], members: [], activityTypes: [] })}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-300"
          >
            Clear All
          </button>
          <button
            onClick={() => { onApply(draft); onClose(); }}
            className="px-5 py-2 text-sm font-medium text-white bg-[#FF6633] hover:bg-[#E55A2B] rounded-lg transition-colors shadow-sm"
          >
            Apply{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

const EMPTY_FILTERS: Filters = { projects: [], members: [], activityTypes: [] };

export function ActivityScreen({
  initialActivities,
  excludeTestProjects = false,
  ssrReady = false,
}: {
  initialActivities?: Activity[];
  /** Hide test projects on the global dashboard (/activity), not per-project views. */
  excludeTestProjects?: boolean;
  /** Server already rendered initial data — don't block the feed on client refetch. */
  ssrReady?: boolean;
}) {
  const [activities, setActivities] = useState<Activity[]>(() =>
    excludeTestProjects
      ? filterActivitiesForMainDashboard(initialActivities || [])
      : initialActivities || []
  );
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [memberOptions, setMemberOptions] = useState<string[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(() => {
    const snap = getActivityFeedSnapshot();
    const hasCache =
      snap != null &&
      (snap.cacheVersion ?? 0) >= ACTIVITY_FEED_CACHE_VERSION &&
      snap.activities.length > 0;
    return !hasCache && !(initialActivities?.length);
  });
  const [loadingActivities, setLoadingActivities] = useState(() => {
    const snap = getActivityFeedSnapshot();
    const hasCache =
      snap != null &&
      (snap.cacheVersion ?? 0) >= ACTIVITY_FEED_CACHE_VERSION &&
      snap.activities.length > 0;
    if (hasCache || (initialActivities?.length ?? 0) > 0) return false;
    if (ssrReady && (initialActivities?.length ?? 0) === 0) return false;
    return true;
  });
  const [revalidatingActivities, setRevalidatingActivities] = useState(false);

  const [search, setSearch] = useState('');
  const { selectedProject } = useProject();
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('all');


  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const initialActivitiesRef = useRef(initialActivities);
  initialActivitiesRef.current = initialActivities;

  // Close date dropdown on click outside
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setDateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);


  const applyActivities = useCallback(
    (
      activitiesData: Activity[],
      rawProjectNames: string[],
      memberNames: string[],
      opts: { cacheSnapshot: boolean; source: 'feed' | 'full' }
    ) => {
      setActivities(
        excludeTestProjects
          ? filterActivitiesForMainDashboard(activitiesData)
          : activitiesData
      );
      if (opts.cacheSnapshot) {
        setActivityFeedSnapshot({
          activities: activitiesData,
          projectNames: rawProjectNames,
          memberNames,
          source: opts.source,
          cacheVersion: ACTIVITY_FEED_CACHE_VERSION,
        });
      }
    },
    [excludeTestProjects]
  );

  // ── Fetch project & employee names + activity feed ─────────────────────────
  const fetchMeta = useCallback(async (opts?: { silent?: boolean; signal?: AbortSignal }) => {
    const silent = opts?.silent === true;
    const signal = opts?.signal;
    const scopedProject =
      !excludeTestProjects && selectedProject && selectedProject !== 'All Projects' ? selectedProject : null;
    if (!silent) {
      setLoadingMeta(true);
      setLoadingActivities(true);
    } else {
      setRevalidatingActivities(true);
    }
    try {
      if (excludeTestProjects) {
        const res = await fetch('/api/activities/bootstrap', { cache: 'no-store', signal });
        if (signal?.aborted) return;
        const data = await res.json();
        if (signal?.aborted) return;
        const projects = Array.isArray(data?.projects) ? data.projects : [];
        const rawProjectNames = projects.map((p: { name: string }) => p.name);
        const memberNames = Array.isArray(data?.memberNames) ? data.memberNames : [];
        const activitiesData = Array.isArray(data?.activities) ? data.activities : [];
        if (projects.length) {
          writeDashboardCache(PROJECTS_RAW_CACHE_KEY, projects);
        }
        setProjectOptions(filterProjectNamesForMainDashboard(rawProjectNames));
        setMemberOptions(memberNames);
        if (!(silent && activitiesData.length === 0)) {
          applyActivities(activitiesData, rawProjectNames, memberNames, {
            cacheSnapshot: true,
            source: 'feed',
          });
        }
      } else {
        const [projRes, empRes, actRes] = await Promise.all([
          fetch('/api/projects', { signal }),
          fetch('/api/employees', { signal }),
          fetch(scopedProject ? `/api/activities?project=${encodeURIComponent(scopedProject)}` : '/api/activities', {
            cache: 'no-store',
            signal,
          }),
        ]);
        if (signal?.aborted) return;
        const [projects, employees, activitiesData] = await Promise.all([
          projRes.json(),
          empRes.json(),
          actRes.json(),
        ]);
        if (signal?.aborted) return;
        const rawProjectNames = (Array.isArray(projects) ? projects : []).map(
          (p: { name: string }) => p.name
        );
        const memberNames = (Array.isArray(employees) ? employees : []).map(
          (e: { name: string }) => e.name
        );
        if (Array.isArray(projects)) {
          writeDashboardCache(PROJECTS_RAW_CACHE_KEY, projects);
        }
        setProjectOptions(rawProjectNames);
        setMemberOptions(memberNames);
        if (!activitiesData?.error && Array.isArray(activitiesData)) {
          if (!(silent && activitiesData.length === 0)) {
            applyActivities(activitiesData, rawProjectNames, memberNames, {
              // Project-scoped data must not overwrite the shared all-projects snapshot.
              cacheSnapshot: !scopedProject,
              source: 'full',
            });
          }
        }
      }
    } catch (e) {
      if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) return;
      // silent — filters will just show empty options
    } finally {
      if (signal?.aborted) {
        setRevalidatingActivities(false);
        return;
      }
      setLoadingMeta(false);
      setLoadingActivities(false);
      setRevalidatingActivities(false);
    }
  }, [applyActivities, excludeTestProjects, selectedProject]);

  useLayoutEffect(() => {
    const snap = getActivityFeedSnapshot();
    const hasCache =
      snap != null && (snap.cacheVersion ?? 0) >= ACTIVITY_FEED_CACHE_VERSION;
    const init = initialActivitiesRef.current;
    const hasSSR = ssrReady || !!init?.length;
    const cacheFresh =
      hasCache && Date.now() - snap!.fetchedAt < ACTIVITY_FEED_STALE_MS;
    const cacheUsableForMain =
      !excludeTestProjects || snap?.source === 'feed' || snap?.source === 'full';

    if (hasCache && cacheUsableForMain) {
      setActivities(
        excludeTestProjects ? filterActivitiesForMainDashboard(snap!.activities) : snap!.activities
      );
      setProjectOptions(
        excludeTestProjects
          ? filterProjectNamesForMainDashboard(snap!.projectNames)
          : snap!.projectNames
      );
      setMemberOptions(snap!.memberNames);
      setLoadingMeta(false);
      setLoadingActivities(false);
    } else if (hasSSR) {
      setActivities(excludeTestProjects ? filterActivitiesForMainDashboard(init!) : init!);
      setLoadingMeta(false);
      setLoadingActivities(false);
      if (excludeTestProjects && init!.length > 0) {
        setActivityFeedSnapshot({
          activities: init!,
          projectNames: [],
          memberNames: [],
          source: 'feed',
          cacheVersion: ACTIVITY_FEED_CACHE_VERSION,
        });
      }
    }

    const needsFullFeed =
      !excludeTestProjects && hasCache && snap?.source === 'feed';

    const ac = new AbortController();
    const silent =
      (excludeTestProjects &&
        (hasSSR || ((cacheFresh && cacheUsableForMain) && (snap?.activities.length ?? 0) > 0))) ||
      (!excludeTestProjects && hasCache && !needsFullFeed && snap?.source === 'full') ||
      (!excludeTestProjects && hasSSR);

    if (excludeTestProjects && cacheFresh && cacheUsableForMain) {
      return () => ac.abort();
    }

    void fetchMeta({ silent, signal: ac.signal });
    return () => ac.abort();
  }, [fetchMeta, excludeTestProjects, ssrReady]);

  // ── Derive filter badge count ──────────────────────────────────────────────
  const activeFilterCount =
    appliedFilters.projects.length +
    appliedFilters.members.length +
    appliedFilters.activityTypes.length;

  const hasUiFilters =
    activeFilterCount > 0 || search.trim().length > 0 || dateRange !== 'all';

  // ── Client-side filter ────────────────────────────────────────────────────
  const filtered = activities.filter(a => {
    if (excludeTestProjects && isExcludedFromMainDashboard(a.project)) return false;

    // 0. Global project scope only on per-project dashboard (not main /activity).
    if (
      !excludeTestProjects &&
      selectedProject !== 'All Projects' &&
      a.project !== selectedProject
    ) {
      return false;
    }

    // 1. Search Query
    const q = search.toLowerCase();

    if (q && !a.employeeName.toLowerCase().includes(q) &&
             !a.project.toLowerCase().includes(q) &&
             !a.action.toLowerCase().includes(q) &&
             !a.metrics.some(m => m.value?.toLowerCase().includes(q))) return false;

    // 2. Applied Filters (Project, Member, Type)
    if (appliedFilters.projects.length && !appliedFilters.projects.includes(a.project)) return false;
    if (appliedFilters.members.length  && !appliedFilters.members.includes(a.employeeName)) return false;
    if (appliedFilters.activityTypes.length && !appliedFilters.activityTypes.includes(a.activityType)) return false;

    // 3. Date range uses report/work day when available (`reportDateYmd`), else submission (`isoTimestamp`).
    if (dateRange !== 'all') {
      const now = new Date();
      const tz = getActivityDisplayTimeZone();
      const dayYmd =
        a.reportDateYmd ??
        (a.isoTimestamp && !Number.isNaN(new Date(a.isoTimestamp).getTime())
          ? formatYmdInTimeZone(new Date(a.isoTimestamp), tz)
          : null);
      if (!dayYmd) return false;

      const inRangeYmd = (ymd: string) => {
        if (dateRange === 'today') return ymd === formatYmdInTimeZone(now, tz);
        if (dateRange === '7d') {
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          const floor = formatYmdInTimeZone(weekAgo, tz);
          return ymd >= floor && ymd <= formatYmdInTimeZone(now, tz);
        }
        if (dateRange === '30d') {
          const monthAgo = new Date(now);
          monthAgo.setDate(now.getDate() - 30);
          const floor = formatYmdInTimeZone(monthAgo, tz);
          return ymd >= floor && ymd <= formatYmdInTimeZone(now, tz);
        }
        return true;
      };

      if (!inRangeYmd(dayYmd)) return false;
    }

    return true;
  });


  if (loadingActivities && activities.length === 0) {
    return <ActivityPageSkeleton />;
  }

  return (
    <div className="min-h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div data-tour="activity-header" className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Activity</h1>
            <p className="text-sm text-gray-500 mt-0.5">Recent activity across all projects</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{filtered.length} records</span>
            <span className="w-2 h-2 bg-[#4CAF50] rounded-full" aria-label="Live" />
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3">
          {/* Date Filter Dropdown */}
          <div data-tour="date-range-filter" className="relative" ref={dateDropdownRef}>
            <button
              onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-all ${
                dateRange !== 'all'
                  ? 'border-[#FF6633] bg-[#FFF3EF] text-[#FF6633]'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>
                {dateRange === 'all' ? 'All Time' :
                 dateRange === 'today' ? 'Today' :
                 dateRange === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
              </span>
            </button>

            {dateDropdownOpen && (
              <div className="absolute z-30 left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden py-1">
                {(['all', 'today', '7d', '30d'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => { setDateRange(r); setDateDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      dateRange === r ? 'text-[#FF6633] font-semibold bg-[#FFF3EF]' : 'text-gray-700'
                    }`}
                  >
                    {r === 'all' ? 'All Time' : r === 'today' ? 'Today' : r === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                  </button>
                ))}
              </div>
            )}
          </div>


          {/* Filters button */}
          <button
            data-tour="filter-button"
            onClick={() => setFilterModalOpen(true)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-all ${
              activeFilterCount > 0
                ? 'border-[#FF6633] bg-[#FFF3EF] text-[#FF6633]'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            {loadingMeta
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <SlidersHorizontal className="w-4 h-4" />}
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 bg-[#FF6633] text-white rounded-full text-xs flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Search */}
          <div data-tour="activity-search" className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search activities..."
              aria-label="Search activities"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 hover:border-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Clear filters shortcut */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => setAppliedFilters(EMPTY_FILTERS)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear filters
            </button>
          )}

          <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all" aria-label="Change view layout">
            <LayoutGrid className="w-4 h-4 text-gray-700" />
          </button>
        </div>

        {/* Active filter pills summary */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {appliedFilters.projects.map(p => (
              <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFE5DC] text-[#E55A2B] rounded-full text-xs font-medium">
                📁 {p}
                <button onClick={() => setAppliedFilters(f => ({ ...f, projects: f.projects.filter(x => x !== p) }))}><X className="w-3 h-3" /></button>
              </span>
            ))}
            {appliedFilters.members.map(m => (
              <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#E8F5E9] text-[#4CAF50] rounded-full text-xs font-medium">
                👤 {m}
                <button onClick={() => setAppliedFilters(f => ({ ...f, members: f.members.filter(x => x !== m) }))}><X className="w-3 h-3" /></button>
              </span>
            ))}
            {appliedFilters.activityTypes.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                🏷 {t}
                <button onClick={() => setAppliedFilters(f => ({ ...f, activityTypes: f.activityTypes.filter(x => x !== t) }))}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Activity Feed */}
      <div
        className={`flex-1 overflow-y-auto p-6 transition-opacity ${
          revalidatingActivities && filtered.length > 0 ? 'opacity-[0.88]' : 'opacity-100'
        }`}
      >
        {loadingActivities ? (
          <div className="flex items-center justify-center h-48">
             <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
            <p className="text-lg font-medium">
              {activities.length > 0 && hasUiFilters
                ? 'No activities match your filters'
                : 'No recent activity yet'}
            </p>
            {hasUiFilters ? (
              <button
                onClick={() => {
                  setAppliedFilters(EMPTY_FILTERS);
                  setSearch('');
                  setDateRange('all');
                }}
                className="text-sm text-[#FF6633] underline"
              >
                Clear all filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((activity, idx) => (
              <div key={activity.id} data-tour={idx === 0 ? "activity-card-0" : undefined}>
                <ActivityCard activity={activity} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters Modal */}
      <FiltersModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        applied={appliedFilters}
        onApply={setAppliedFilters}
        projectOptions={projectOptions}
        memberOptions={memberOptions}
      />
    </div>
  );
}
