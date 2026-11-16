"use client";

import { useProject } from "@/context/ProjectContext";
import { 
  FileText, ClipboardList, PenTool, AlertCircle, 
  Search, Eye, Activity, Image as ImageIcon, 
  FileSpreadsheet, MessageSquare, Clipboard, Loader2,
  Plus, MoreHorizontal, ArrowUpDown, Calendar,
  Clock, User, TrendingUp, BarChart as BarChartIcon,
  CheckCircle2, AlertTriangle, Info, Briefcase, ChevronDown, ChevronUp, ChevronRight,
  Maximize2, Share2, Star, Save, MapPin,   Building2, Hash, Pencil, Trash2, X, Tag
} from "lucide-react";
import { useEffect, useState, useMemo, useLayoutEffect } from "react";
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import {
  getActivityDisplayTimeZone,
  formatYmdInTimeZone,
  formatMonthDayInTimeZone,
  formatMonthDayTimeInTimeZone,
  formatHmAmInTimeZone,
} from "@/lib/activity-display-timezone";
import { loggedAtYmd, resolveRowReportDateYmd } from "@/lib/report-date-filter";
import { isSafetyTalkCompletedStatus } from "@/lib/safety-talk-status";
import NextImage from "next/image";
import { normalizeRemotePhotoUrl, isBrowserResolvableUrl } from "@/lib/photo-url";
import { ImageViewer } from "./ImageViewer";
import { ActivityCard } from "./ActivityCard";
import type { Activity as ActivityType } from "./ActivityScreen";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { DirectoryScreen } from "./DirectoryScreen";
import { ProjectClientPortalSettings } from "./ProjectClientPortalSettings";
import { EquipmentChecklistCard } from "./EquipmentChecklistCard";
import {
  readDashboardCache,
  writeDashboardCache,
  invalidateDashboardCacheKey,
  PROJECTS_RAW_CACHE_KEY,
} from "@/lib/dashboard-data-cache";
import { getActivityFeedSnapshot, upsertActivitiesInFeedCache, clearActivityFeedSnapshot } from "@/lib/activity-feed-client-cache";
import { inferPositiveAnswer } from "@/lib/survey-default-questions";
import { resolveMetricNumeric } from "@/lib/metric-values";
import { resolveObservationDescription } from "@/lib/observation-fields";
import {
  filterProjectNamesForMainDashboard,
  isExcludedFromMainDashboard,
} from "@/lib/activity-excluded-projects";

interface ProjectDetailScreenProps {
  title: string;
  icon: any;
  emptyMessage?: string;
  dataType?: 'activity' | 'attachments' | 'checklists' | 'safety-talks' | 'observations' | 'incidents' | 'notes' | 'survey' | 'directory' | 'gallery' | 'settings' | 'metrics' | 'chemicals';
  /** Hide test projects on global dashboard views (e.g. /insights/summary), not per-project sidebar. */
  excludeTestProjects?: boolean;
}

/** Cached GET for list endpoints (notes, survey, etc.); restores before paint when revisiting a tab. */
function useCachedJsonList(active: boolean, url: string) {
  const cacheKey = `GET:${url}`;
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    if (!active) return;
    const cached = readDashboardCache<any[]>(cacheKey);
    const hasCache = cached != null && Array.isArray(cached);
    if (hasCache) {
      setData(cached);
      setLoading(false);
    }
    const ac = new AbortController();
    if (!hasCache) setLoading(true);
    fetch(url, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => {
        if (ac.signal.aborted) return;
        const arr = Array.isArray(d) ? d : [];
        setData(arr);
        writeDashboardCache(cacheKey, arr);
      })
      .catch(() => {
        if (!ac.signal.aborted) setData([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [active, url, cacheKey]);

  return { data, setData, loading, cacheKey };
}

export function ProjectDetailScreen({
  title,
  icon: Icon,
  emptyMessage,
  dataType,
  excludeTestProjects = false,
}: ProjectDetailScreenProps) {
  const { selectedProject, setSelectedProject, selectedDate } = useProject();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<'1d' | '7d' | '30d' | 'all' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectsList, setProjectsList] = useState<string[]>([]);
  const [viewerState, setViewerState] = useState<{ isOpen: boolean; index: number; list: any[] }>({
    isOpen: false,
    index: 0,
    list: []
  });

  /** After tags are edited in the photo viewer, reflect them in the gallery + open viewer. */
  const handleAttachmentTagsChanged = (sourceId: string, tags: string[]) => {
    setData((prev) =>
      prev.map((activity) => (activity.id === sourceId ? { ...activity, tags } : activity))
    );
    setViewerState((v) => ({
      ...v,
      list: v.list.map((p: any) => (p.sourceId === sourceId ? { ...p, tags } : p)),
    }));
  };

  const handleProjectPhotoDeleted = (deletedUrl: string) => {
    const target = normalizeRemotePhotoUrl(deletedUrl).split('?')[0].toLowerCase();
    const matches = (u: string) =>
      normalizeRemotePhotoUrl(u).split('?')[0].toLowerCase() === target;

    setData((prev) =>
      prev
        .map((activity) => {
          const photos = Array.isArray(activity.photos) ? activity.photos : [];
          const nextPhotos = photos.filter((u: string) => !matches(String(u)));
          if (nextPhotos.length === photos.length) return activity;
          if (nextPhotos.length === 0) return null;
          return { ...activity, photos: nextPhotos };
        })
        .filter(Boolean)
    );

    setViewerState((v) => {
      const nextList = v.list.filter((p) => !matches(String(p.url || '')));
      if (nextList.length === 0) return { isOpen: false, index: 0, list: [] };
      return {
        ...v,
        list: nextList,
        index: Math.min(v.index, nextList.length - 1),
      };
    });

    clearActivityFeedSnapshot();
  };

  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [filterType, setFilterType] = useState<'all' | 'photos' | 'documents'>('all');
  const [gallerySelectedTags, setGallerySelectedTags] = useState<string[]>([]);
  const [galleryFiltersOpen, setGalleryFiltersOpen] = useState(false);

  useEffect(() => {
    if (
      excludeTestProjects &&
      selectedProject &&
      selectedProject !== "All Projects" &&
      isExcludedFromMainDashboard(selectedProject)
    ) {
      setSelectedProject("All Projects");
    }
  }, [excludeTestProjects, selectedProject, setSelectedProject]);

  const visibleProjectsList = useMemo(() => {
    if (!excludeTestProjects) return projectsList;
    return projectsList.filter(
      (p) => p === "All Projects" || !isExcludedFromMainDashboard(p)
    );
  }, [projectsList, excludeTestProjects]);

  // ── Settings / project-edit state ──
  const [settingsProject, setSettingsProject] = useState<any>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsForm, setSettingsForm] = useState<any>(null);
  const [settingsAddressQuery, setSettingsAddressQuery] = useState('');
  const [settingsAddressResults, setSettingsAddressResults] = useState<any[]>([]);
  const [settingsSearching, setSettingsSearching] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "client-portal">("general");
  const [settingsEmployees, setSettingsEmployees] = useState<{ id: string; name: string; role: string }[]>([]);

  type SurveyPositiveAnswer = 'Yes' | 'No';
  type SurveyQuestionDraft = {
    key: string;
    question: string;
    requires_text_description: boolean;
    positive_answer: SurveyPositiveAnswer;
  };
  const [surveyQuestionDrafts, setSurveyQuestionDrafts] = useState<SurveyQuestionDraft[]>([]);
  const [surveyQuestionsLoading, setSurveyQuestionsLoading] = useState(false);
  const [surveyQuestionsSaving, setSurveyQuestionsSaving] = useState(false);
  const [surveyQuestionsError, setSurveyQuestionsError] = useState<string | null>(null);
  const [surveyQuestionsSuccess, setSurveyQuestionsSuccess] = useState(false);

  // Fetch project record when showing settings
  useEffect(() => {
    if (dataType !== 'settings' || !selectedProject || selectedProject === 'All Projects') return;

    const mapSettingsForm = (found: any) => ({
      name: found.name || '',
      job_number: found.job_number || '',
      client_name: found.client_name || '',
      street_address: found.street_address || '',
      city: found.city || '',
      state: found.state || '',
      zip_code: found.zip_code || '',
      country: found.country || 'United States',
      start_date: found.start_date || '',
      end_date: found.end_date || '',
      project_template: found.project_template || 'Wicking Jobs Template | Company default template',
      status: found.status || 'active',
      contract_po: found.contract_po || '',
      contract_expiration: found.contract_expiration?.slice?.(0, 10) || found.contract_expiration || '',
      wickd_contact_employee_id: found.wickd_contact_employee_id || '',
      superintendent_name: found.superintendent_name || '',
      superintendent_phone: found.superintendent_phone || '',
      gate_code: found.gate_code || '',
    });

    const rawCached = readDashboardCache<any[]>(PROJECTS_RAW_CACHE_KEY);
    if (Array.isArray(rawCached)) {
      const found = rawCached.find((p: any) => p.name === selectedProject);
      if (found) {
        setSettingsProject(found);
        setSettingsForm(mapSettingsForm(found));
      }
    }

    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsSuccess(false);
    fetch('/api/projects')
      .then(r => r.json())
      .then((projects: any[]) => {
        if (Array.isArray(projects)) writeDashboardCache(PROJECTS_RAW_CACHE_KEY, projects);
        const found = projects.find((p: any) => p.name === selectedProject);
        if (found) {
          setSettingsProject(found);
          setSettingsForm(mapSettingsForm(found));
        } else {
          setSettingsError('Could not find project details.');
        }
      })
      .catch(() => setSettingsError('Failed to load project.'))
      .finally(() => setSettingsLoading(false));
  }, [dataType, selectedProject]);

  useEffect(() => {
    if (dataType !== 'settings') return;
    fetch('/api/employees')
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setSettingsEmployees(
          data
            .filter((e: { status?: string }) => e.status !== 'inactive')
            .map((e: { id: string; name: string; role?: string }) => ({
              id: e.id,
              name: e.name,
              role: e.role || '',
            }))
            .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
        );
      })
      .catch(() => setSettingsEmployees([]));
  }, [dataType]);

  useEffect(() => {
    setGallerySelectedTags([]);
    setGalleryFiltersOpen(false);
  }, [selectedProject]);

  useEffect(() => {
    if (dataType !== 'settings' || !settingsProject?.id) return;
    setSurveyQuestionsLoading(true);
    setSurveyQuestionsError(null);
    setSurveyQuestionsSuccess(false);
    fetch(`/api/projects/${settingsProject.id}/survey-questions`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        const qs = Array.isArray(d.questions) ? d.questions : [];
        setSurveyQuestionDrafts(
          qs.map((q: {
            id?: string;
            question?: string;
            requires_text_description?: boolean;
            positive_answer?: SurveyPositiveAnswer;
          }) => ({
            key: q.id || `draft-${crypto.randomUUID()}`,
            question: q.question || '',
            requires_text_description: !!q.requires_text_description,
            positive_answer: q.positive_answer === 'No' ? 'No' : 'Yes',
          }))
        );
      })
      .catch(() => {
        setSurveyQuestionsError('Failed to load site survey questions.');
        setSurveyQuestionDrafts([]);
      })
      .finally(() => setSurveyQuestionsLoading(false));
  }, [dataType, settingsProject?.id]);

  const moveSurveyQuestion = (index: number, dir: -1 | 1) => {
    setSurveyQuestionDrafts((prev) => {
      const next = index + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
  };

  const saveSurveyQuestions = async () => {
    if (!settingsProject?.id) return;
    setSurveyQuestionsSaving(true);
    setSurveyQuestionsError(null);
    setSurveyQuestionsSuccess(false);
    const questions = surveyQuestionDrafts
      .map((d, i) => ({
        question: d.question.trim(),
        sort_order: i,
        requires_text_description: d.requires_text_description,
        positive_answer: d.positive_answer,
      }))
      .filter((q) => q.question.length > 0);
    try {
      const res = await fetch(`/api/projects/${settingsProject.id}/survey-questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const qs = Array.isArray(data.questions) ? data.questions : [];
      setSurveyQuestionDrafts(
        qs.map((q: {
          id: string;
          question: string;
          requires_text_description: boolean;
          positive_answer?: SurveyPositiveAnswer;
        }) => ({
          key: q.id,
          question: q.question,
          requires_text_description: !!q.requires_text_description,
          positive_answer: q.positive_answer === 'No' ? 'No' : 'Yes',
        }))
      );
      setSurveyQuestionsSuccess(true);
      setTimeout(() => setSurveyQuestionsSuccess(false), 3000);
    } catch (e: unknown) {
      setSurveyQuestionsError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSurveyQuestionsSaving(false);
    }
  };

  // Address autocomplete for settings form
  useEffect(() => {
    if (!settingsAddressQuery || settingsAddressQuery.length < 3) { setSettingsAddressResults([]); return; }
    const timer = setTimeout(async () => {
      setSettingsSearching(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(settingsAddressQuery)}&format=json&addressdetails=1&countrycodes=us,ca`);
        if (res.ok) setSettingsAddressResults(await res.json());
      } catch {} finally { setSettingsSearching(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [settingsAddressQuery]);

  const settingsSelectAddress = (result: any) => {
    const p = result.address;
    const street = [p.house_number, p.road].filter(Boolean).join(' ') || p.hamlet || p.suburb || '';
    setSettingsForm((prev: any) => ({
      ...prev,
      street_address: street,
      city: p.city || p.town || p.village || '',
      state: p.state || '',
      zip_code: p.postcode || '',
      country: p.country || 'United States',
    }));
    setSettingsAddressQuery('');
    setSettingsAddressResults([]);
  };

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsProject) return;
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsSuccess(false);
    try {
      const res = await fetch(`/api/projects/${settingsProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Update failed');
      }
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
      invalidateDashboardCacheKey(PROJECTS_RAW_CACHE_KEY);
    } catch (e: unknown) {
      setSettingsError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSettingsSaving(false);
    }
  };

  const setF = (field: string, value: string) =>
    setSettingsForm((prev: any) => ({ ...prev, [field]: value }));

  const metricsUrl = useMemo(() => {
    const d = format(selectedDate, 'yyyy-MM-dd');
    const p = new URLSearchParams({ date: d });
    if (selectedProject && selectedProject !== 'All Projects') p.set('project', selectedProject);
    return `/api/metrics?${p.toString()}`;
  }, [selectedDate, selectedProject]);

  const chemicalsUrl = useMemo(() => {
    const d = format(selectedDate, 'yyyy-MM-dd');
    const p = new URLSearchParams({ date: d });
    if (selectedProject && selectedProject !== 'All Projects') p.set('project', selectedProject);
    return `/api/chemicals?${p.toString()}`;
  }, [selectedDate, selectedProject]);

  const notesUrl = useMemo(() => {
    const d = format(selectedDate, 'yyyy-MM-dd');
    const p = new URLSearchParams({ date: d });
    if (selectedProject && selectedProject !== 'All Projects') p.set('project', selectedProject);
    return `/api/notes?${p.toString()}`;
  }, [selectedDate, selectedProject]);

  const surveyUrl = useMemo(() => {
    const d = format(selectedDate, 'yyyy-MM-dd');
    const p = new URLSearchParams({ date: d });
    if (selectedProject && selectedProject !== 'All Projects') p.set('project', selectedProject);
    return `/api/survey?${p.toString()}`;
  }, [selectedDate, selectedProject]);

  const observationsUrl = useMemo(() => {
    const p = new URLSearchParams({ status: 'open' });
    if (selectedProject && selectedProject !== 'All Projects') p.set('project', selectedProject);
    return `/api/observations?${p.toString()}`;
  }, [selectedProject]);

  const incidentsUrl = useMemo(() => {
    const d = format(selectedDate, 'yyyy-MM-dd');
    const p = new URLSearchParams({ date: d });
    if (selectedProject && selectedProject !== 'All Projects') p.set('project', selectedProject);
    return `/api/incidents?${p.toString()}`;
  }, [selectedDate, selectedProject]);

  const safetyTalksUrl = useMemo(() => {
    const d = format(selectedDate, 'yyyy-MM-dd');
    const p = new URLSearchParams({ date: d });
    if (selectedProject && selectedProject !== 'All Projects') p.set('project', selectedProject);
    return `/api/safety-talks/events?${p.toString()}`;
  }, [selectedDate, selectedProject]);

  const equipmentChecklistsUrl = useMemo(() => {
    const d = format(selectedDate, 'yyyy-MM-dd');
    const p = new URLSearchParams({ date: d });
    if (selectedProject && selectedProject !== 'All Projects') p.set('project', selectedProject);
    return `/api/equipment-checklists?${p.toString()}`;
  }, [selectedDate, selectedProject]);

  const { data: metricsData, loading: metricsLoading } = useCachedJsonList(dataType === 'metrics', metricsUrl);
  type CompanyMetricField = {
    id: string;
    key: string;
    label: string;
    unit: string;
    sort_order: number;
    is_active: boolean;
  };
  const [companyMetricFields, setCompanyMetricFields] = useState<CompanyMetricField[]>([]);
  const [companyMetricFieldsLoading, setCompanyMetricFieldsLoading] = useState(false);

  useEffect(() => {
    if (dataType !== 'metrics') return;
    let cancelled = false;
    setCompanyMetricFieldsLoading(true);
    fetch('/api/company/metric-fields?active=1', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setCompanyMetricFields(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCompanyMetricFields([]);
      })
      .finally(() => {
        if (!cancelled) setCompanyMetricFieldsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataType]);

  const { data: chemicalsData, loading: chemicalsLoading } = useCachedJsonList(
    dataType === 'chemicals',
    chemicalsUrl
  );
  const { data: notesData, loading: notesLoading } = useCachedJsonList(dataType === 'notes', notesUrl);
  const { data: surveyData, loading: surveyLoading } = useCachedJsonList(dataType === 'survey', surveyUrl);
  const {
    data: observationsData,
    setData: setObservationsData,
    loading: observationsLoading,
    cacheKey: observationsCacheKey,
  } = useCachedJsonList(
    dataType === 'observations',
    observationsUrl
  );
  const { data: incidentsData, loading: incidentsLoading } = useCachedJsonList(
    dataType === 'incidents',
    incidentsUrl
  );
  const { data: safetyTalksData, loading: safetyTalksLoading } = useCachedJsonList(
    dataType === 'safety-talks',
    safetyTalksUrl
  );

  const safetyTalksByDate = useMemo(() => {
    if (!Array.isArray(safetyTalksData) || safetyTalksData.length === 0) return [];
    const map = new Map<string, any[]>();
    for (const t of safetyTalksData) {
      const d = String(t.display_date || t.scheduled_date || format(selectedDate, 'yyyy-MM-dd')).slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(t);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, talks]) => ({ date, talks }));
  }, [safetyTalksData, selectedDate]);

  const { data: equipmentChecklistsData, loading: equipmentChecklistsLoading } = useCachedJsonList(
    dataType === 'checklists',
    equipmentChecklistsUrl
  );

  useLayoutEffect(() => {
    const raw = readDashboardCache<any[]>(PROJECTS_RAW_CACHE_KEY);
    if (Array.isArray(raw) && raw.length) {
      setProjectsList(['All Projects', ...raw.map((x: any) => x.name)]);
    }
    const ac = new AbortController();
    fetch('/api/projects', { signal: ac.signal })
      .then((res) => res.json())
      .then((p) => {
        if (ac.signal.aborted) return;
        if (Array.isArray(p)) {
          writeDashboardCache(PROJECTS_RAW_CACHE_KEY, p);
          setProjectsList(['All Projects', ...p.map((x: any) => x.name)]);
        }
      })
      .catch(console.error);
    return () => ac.abort();
  }, []);

  useLayoutEffect(() => {
    if (!selectedProject || !selectedDate) return;

    const skipActivitiesFetch =
      dataType === 'incidents' ||
      dataType === 'safety-talks' ||
      dataType === 'notes' ||
      dataType === 'survey' ||
      dataType === 'observations' ||
      dataType === 'metrics' ||
      dataType === 'chemicals' ||
      dataType === 'checklists' ||
      dataType === 'directory' ||
      dataType === 'settings';

    if (skipActivitiesFetch) {
      setData([]);
      setLoading(false);
      return;
    }

    const applyActivityFilters = (activities: any[]) => {
      const tz = getActivityDisplayTimeZone();
      const matchProject = (a: any) => selectedProject === 'All Projects' || a.project === selectedProject;
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const matchDate = (a: any) => {
        if (dataType === 'gallery') return true;
        if (dataType === 'activity') {
          if (timeRange === 'all') return true;
          const workYmd =
            a.reportDateYmd ??
            a.selectedDateYmd ??
            (a.isoTimestamp && !Number.isNaN(new Date(a.isoTimestamp).getTime())
              ? formatYmdInTimeZone(new Date(a.isoTimestamp), tz)
              : null);

          if (timeRange === 'custom') {
            if (workYmd) {
              const startYmd = format(startDate, 'yyyy-MM-dd');
              const endYmd = format(endDate, 'yyyy-MM-dd');
              return workYmd >= startYmd && workYmd <= endYmd;
            }
            const itemDate = new Date(a.isoTimestamp || a.timestamp);
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return itemDate >= start && itemDate <= end;
          }

          if (timeRange === '1d') {
            return workYmd != null ? workYmd === dateStr : formatYmdInTimeZone(new Date(a.isoTimestamp || a.timestamp), tz) === dateStr;
          }
          if (!workYmd) {
            const itemDate = new Date(a.isoTimestamp || a.timestamp);
            const refDate = new Date(selectedDate);
            const diffDays = Math.floor((refDate.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
            if (timeRange === '7d') return diffDays >= 0 && diffDays < 7;
            if (timeRange === '30d') return diffDays >= 0 && diffDays < 30;
            return false;
          }
          const ref = new Date(`${dateStr}T12:00:00.000Z`);
          const work = new Date(`${workYmd}T12:00:00.000Z`);
          const diffDays = Math.floor((ref.getTime() - work.getTime()) / (1000 * 60 * 60 * 24));
          if (timeRange === '7d') return diffDays >= 0 && diffDays < 7;
          if (timeRange === '30d') return diffDays >= 0 && diffDays < 30;
        }
        const ymd =
          a.reportDateYmd ??
          (a.isoTimestamp && !Number.isNaN(new Date(a.isoTimestamp).getTime())
            ? formatYmdInTimeZone(new Date(a.isoTimestamp), tz)
            : null);
        return (ymd != null && ymd === dateStr) || a.timestamp.includes(dateStr);
      };

      let filtered = activities.filter((a) => {
        if (excludeTestProjects && isExcludedFromMainDashboard(a.project)) return false;
        return matchProject(a) && matchDate(a);
      });

      if (dataType === 'activity') {
        filtered = filtered.filter(
          (a) =>
            a.action?.toLowerCase().includes('insight') ||
            a.activityType?.toLowerCase().includes('metric') ||
            a.metrics?.length > 0
        );
      } else if (dataType === 'attachments') {
        filtered = filtered.filter((a) => a.activityType === 'Attachments');
      }
      return filtered;
    };

    const snap = getActivityFeedSnapshot();
    if (snap != null) {
      setData(applyActivityFilters(snap.activities));
      setLoading(false);
    } else {
      setLoading(true);
    }

    const ac = new AbortController();
    const scoped = selectedProject !== 'All Projects';
    fetch(scoped ? `/api/activities?project=${encodeURIComponent(selectedProject)}` : '/api/activities', {
      cache: 'no-store',
      signal: ac.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((activities: any[]) => {
        if (ac.signal.aborted) return;
        if (!scoped) upsertActivitiesInFeedCache(activities);
        setData(applyActivityFilters(activities));
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        console.error('Fetch error:', err);
        setData([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [dataType, selectedProject, selectedDate, timeRange, startDate, endDate, excludeTestProjects]);

  // Derive Insights Data
  const insightsMetrics = useMemo(() => {
    if (dataType !== 'activity') return null;
    
    // Group by activity type for a distribution chart
    const distribution: { [key: string]: number } = {};
    data.forEach(item => {
      const type = item.activityType || 'General';
      distribution[type] = (distribution[type] || 0) + 1;
    });

    const chartData = Object.entries(distribution).map(([name, value]) => ({ name, value }));

    // Group by day for a trend chart (last 14 days)
    const trends: { [key: string]: number } = {};
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = format(subDays(today, i), "MMM d");
      trends[d] = 0;
    }

    data.forEach(item => {
      const d = item.isoTimestamp ? formatMonthDayInTimeZone(item.isoTimestamp) : null;
      if (d && trends[d] !== undefined) {
        trends[d]++;
      }
    });

    const trendData = Object.entries(trends).map(([date, count]) => ({ date, count }));

    return { chartData, trendData };
  }, [data, dataType]);

  // ─── Metrics Dashboard ───
  if (dataType === 'metrics') {
    const legacyStatFields = [
      { key: 'water_usage',            label: 'Water Usage',            unit: 'gal',  icon: '💧', color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-100' },
      { key: 'acres_completed',        label: 'Acres Completed',        unit: 'ac',   icon: '🌿', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
      { key: 'green_space_completed',  label: 'Green Space Completed',  unit: 'sqft', icon: '🏞', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
      { key: 'number_of_operators',    label: 'Operators',              unit: '',     icon: '👷', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
    ];

    const palette = [
      { icon: '🌿', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
      { icon: '🏞', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
      { icon: '💧', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
      { icon: '👷', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
      { icon: '📐', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100' },
      { icon: '📊', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    ];

    const statFields =
      companyMetricFields.length > 0
        ? companyMetricFields.map((f, i) => {
            const style = palette[i % palette.length];
            return {
              key: f.key,
              label: f.label,
              unit: f.unit === 'count' ? '' : f.unit,
              ...style,
            };
          })
        : legacyStatFields;

    const resolveMetricValue = (entry: any, key: string) => {
      return resolveMetricNumeric(entry, key);
    };

    return (
      <div className="h-full flex flex-col bg-gray-50 flex-1 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-5 bg-white border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Metrics</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {format(selectedDate, 'EEEE, MMMM d yyyy')}
              {metricsData.length > 0
                ? ` · latest submission${metricsData.length > 1 ? `s (${metricsData.length} projects)` : ''}`
                : ' · no metrics yet'}
            </p>
          </div>
          <a href="/company/metrics" className="text-xs font-medium text-[#FF6633] hover:underline">
            Edit custom metrics
          </a>
        </div>

        <div className="flex-1 overflow-auto px-8 py-6">
          {metricsLoading || companyMetricFieldsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" />
            </div>
          ) : metricsData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <BarChartIcon className="w-10 h-10 text-gray-200" />
              <p className="text-sm font-medium">No metrics logged for this date</p>
              <p className="text-xs text-gray-400">Metrics are recorded from the mobile field app</p>
            </div>
          ) : (
            <div className="space-y-6">
              {metricsData.map((entry: any, idx: number) => {
                const loggedAt = entry.logged_at ? new Date(entry.logged_at) : null;
                const photos: string[] = Array.isArray(entry.photos) ? entry.photos : [];
                return (
                  <div key={entry.id || idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Entry header */}
                    <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#FF6633]/10 flex items-center justify-center text-[#FF6633] font-bold text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Daily metrics</p>
                          {loggedAt && (
                            <p className="text-xs text-gray-400">
                              {format(loggedAt, 'h:mm a · MMM d, yyyy')}
                              {entry.report_date
                                ? ` · report ${String(entry.report_date).slice(0, 10)}`
                                : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-gray-100">
                      {statFields.map(({ key, label, unit, icon, color, bg }) => {
                        const val = resolveMetricValue(entry, key);
                        const hasVal = val !== null;
                        return (
                          <div key={key} className={`${bg} p-5 flex flex-col gap-1`}>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                              <span>{icon}</span>{label}
                            </p>
                            <p className={`text-3xl font-bold ${hasVal ? color : 'text-gray-300'}`}>
                              {hasVal ? val : '—'}
                            </p>
                            {hasVal && unit && (
                              <p className="text-xs font-medium text-gray-400">{unit}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Notes */}
                    {entry.notes && (
                      <div className="px-6 py-4 border-t border-gray-50">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Notes</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{entry.notes}</p>
                      </div>
                    )}

                    {/* Photos */}
                    {photos.length > 0 && (
                      <div className="px-6 py-4 border-t border-gray-50">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Photos ({photos.length})</p>
                        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
                          {photos.map((url: string, pi: number) => (
                            <div
                              key={pi}
                              className="aspect-square relative rounded-lg overflow-hidden border border-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setViewerState({ isOpen: true, index: pi, list: photos.map((u: string) => ({ url: u, fileName: u.split('/').pop() })) })}
                            >
                              <NextImage src={url} alt={`Photo ${pi + 1}`} fill className="object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <ImageViewer
          isOpen={viewerState.isOpen}
          photos={viewerState.list.map((p: any) => p.url)}
          initialIndex={viewerState.index}
          onClose={() => setViewerState({ ...viewerState, isOpen: false })}
          metadata={viewerState.list[viewerState.index]}
        />
      </div>
    );
  }

  // ─── Equipment Checklists ───
  if (dataType === 'checklists') {
    return (
      <div className="h-full flex flex-col bg-gray-50 flex-1 overflow-hidden">
        <div className="px-8 py-5 bg-white border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Equipment Checklists</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {format(selectedDate, 'EEEE, MMMM d yyyy')} · {equipmentChecklistsData.length} checklist
            {equipmentChecklistsData.length !== 1 ? 's' : ''} (report date)
          </p>
        </div>

        <div className="flex-1 overflow-auto px-8 py-6">
          {equipmentChecklistsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" />
            </div>
          ) : equipmentChecklistsData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <ClipboardList className="w-10 h-10 text-gray-200" />
              <p className="text-sm font-medium">No equipment checklists for this report date</p>
              <p className="text-xs text-gray-400 text-center max-w-sm">
                Checklists are grouped by the work day (report date) chosen in the field app, not when they were submitted.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {equipmentChecklistsData.map((entry: Record<string, unknown>, idx: number) => (
                <EquipmentChecklistCard
                  key={String(entry.id ?? idx)}
                  row={entry}
                  index={idx}
                  onPhotoClick={(photos, pi) =>
                    setViewerState({
                      isOpen: true,
                      index: pi,
                      list: photos.map((u) => ({ url: u, fileName: u.split('/').pop() })),
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>

        <ImageViewer
          isOpen={viewerState.isOpen}
          photos={viewerState.list.map((p: { url: string }) => p.url)}
          initialIndex={viewerState.index}
          onClose={() => setViewerState({ ...viewerState, isOpen: false })}
          metadata={viewerState.list[viewerState.index]}
        />
      </div>
    );
  }

  // ─── Chemicals Dashboard ───
  if (dataType === 'chemicals') {
    return (
      <div className="h-full flex flex-col bg-gray-50 flex-1 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-5 bg-white border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Chemicals</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {format(selectedDate, 'EEEE, MMMM d yyyy')} · {chemicalsData.length} log{chemicalsData.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex-1 overflow-auto px-8 py-6">
          {chemicalsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" />
            </div>
          ) : chemicalsData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <FileSpreadsheet className="w-10 h-10 text-gray-200" />
              <p className="text-sm font-medium">No chemical logs for this date</p>
              <p className="text-xs text-gray-400">Chemical logs are recorded from the mobile field app</p>
            </div>
          ) : (
            <div className="space-y-6">
              {chemicalsData.map((entry: any, idx: number) => {
                const loggedAt = entry.logged_at ? new Date(entry.logged_at) : null;
                const chemicals: { name: string; quantity: number; unit: string }[] =
                  Array.isArray(entry.chemicals) ? entry.chemicals : [];
                const photos: string[] = Array.isArray(entry.photos) ? entry.photos : [];

                return (
                  <div key={entry.id || idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Entry header */}
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#FF6633]/10 flex items-center justify-center text-[#FF6633] font-bold text-sm">{idx + 1}</div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Chemical Log #{idx + 1}</p>
                          {loggedAt && <p className="text-xs text-gray-400">{format(loggedAt, 'h:mm a · MMM d, yyyy')}</p>}
                        </div>
                      </div>
                      {/* Application method badge */}
                      {entry.application_type && (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                          entry.application_type === 'Spraying'
                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                            : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          <span>{entry.application_type === 'Spraying' ? '💧' : '🖊'}</span>
                          {entry.application_type}
                        </span>
                      )}
                    </div>

                    {/* Chemical items table */}
                    {chemicals.length > 0 ? (
                      <div className="divide-y divide-gray-50">
                        {/* Table header */}
                        <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-2.5 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          <span>Chemical</span>
                          <span className="text-right w-20">Amount</span>
                          <span className="w-16 text-right">Unit</span>
                        </div>
                        {chemicals.map((chem, ci) => (
                          <div key={ci} className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-3.5 items-center hover:bg-gray-50/50 transition-colors">
                            <span className="text-sm font-medium text-gray-900">{chem.name}</span>
                            <span className="text-sm font-bold text-gray-800 w-20 text-right tabular-nums">{chem.quantity}</span>
                            <span className="text-xs font-semibold text-gray-400 w-16 text-right uppercase">{chem.unit}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-6 py-4 text-sm text-gray-400 italic">No chemical items recorded</div>
                    )}

                    {/* Notes */}
                    {entry.notes && (
                      <div className="px-6 py-4 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Notes</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{entry.notes}</p>
                      </div>
                    )}

                    {/* Photos */}
                    {photos.length > 0 && (
                      <div className="px-6 py-4 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Photos ({photos.length})</p>
                        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
                          {photos.map((url: string, pi: number) => (
                            <div
                              key={pi}
                              className="aspect-square relative rounded-lg overflow-hidden border border-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setViewerState({ isOpen: true, index: pi, list: photos.map((u: string) => ({ url: u, fileName: u.split('/').pop() })) })}
                            >
                              <NextImage src={url} alt={`Photo ${pi + 1}`} fill className="object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <ImageViewer
          isOpen={viewerState.isOpen}
          photos={viewerState.list.map((p: any) => p.url)}
          initialIndex={viewerState.index}
          onClose={() => setViewerState({ ...viewerState, isOpen: false })}
          metadata={viewerState.list[viewerState.index]}
        />
      </div>
    );
  }

  // (Inventory view removed)
  // ─── Settings (Inline Project Edit) ───
  if (dataType === 'settings') {
    if (selectedProject === 'All Projects') {
      return (
        <div className="h-full flex items-center justify-center flex-col gap-3 text-gray-400">
          <Briefcase className="w-10 h-10 text-gray-200" />
          <p className="text-sm font-medium">Select a specific project to edit its settings.</p>
        </div>
      );
    }

    if (settingsLoading) {
      return (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" />
        </div>
      );
    }

    if (!settingsForm) {
      return (
        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
          {settingsError || 'No project data found.'}
        </div>
      );
    }

    const PROJECT_TEMPLATES = [
      'Wicking Jobs Template | Company default template',
      'Infrastructure Template',
      'Environmental Project Template',
      'General Construction Template',
    ];

    return (
      <div className="h-full flex flex-col bg-gray-50 flex-1 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 bg-white border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {settingsTab === "client-portal" ? "Client Portal" : "Project Settings"}
            </h2>
            <div className="flex gap-1 mt-4 border-b border-gray-100 -mb-px">
              {(
                [
                  { id: "general" as const, label: "General" },
                  { id: "client-portal" as const, label: "Client Portal" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  data-tour={tab.id === "client-portal" ? "client-portal-nav" : undefined}
                  type="button"
                  onClick={() => setSettingsTab(tab.id)}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                    settingsTab === tab.id
                      ? "border-[#FF6633] text-[#FF6633]"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 self-start">
            {settingsSuccess && settingsTab === "general" && (
              <span className="text-sm font-medium text-green-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Saved successfully
              </span>
            )}
            {settingsTab === "general" ? (
              <button
                form="settings-form"
                type="submit"
                disabled={settingsSaving}
                className="flex items-center gap-2 px-5 py-2 bg-[#FF6633] text-white rounded-lg text-sm font-medium hover:bg-[#E55A2B] transition-all shadow-sm disabled:opacity-60"
              >
                {settingsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save changes
              </button>
            ) : null}
          </div>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-auto">
          {settingsTab === "client-portal" && settingsProject?.id ? (
            <div className="max-w-3xl mx-auto px-8 py-8">
              <ProjectClientPortalSettings projectId={settingsProject.id} />
            </div>
          ) : (
          <form id="settings-form" onSubmit={handleSettingsSave}>
            <div className="max-w-3xl mx-auto px-8 py-8 space-y-8">
              {settingsError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {settingsError}
                </div>
              )}

              {/* Section: Basic Info */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Basic Information</h3>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Project Name</label>
                      <input type="text" required value={settingsForm.name} onChange={e => setF('name', e.target.value)} placeholder="Project name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Job #</label>
                      <input type="text" required value={settingsForm.job_number} onChange={e => setF('job_number', e.target.value)} placeholder="Job number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Client Name</label>
                      <input type="text" value={settingsForm.client_name} onChange={e => setF('client_name', e.target.value)} placeholder="Client name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
                      <select value={settingsForm.status} onChange={e => setF('status', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all text-gray-700">
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start Date</label>
                      <input type="date" value={settingsForm.start_date} onChange={e => setF('start_date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">End Date</label>
                      <input type="date" value={settingsForm.end_date} onChange={e => setF('end_date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all text-gray-700" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Project Template</label>
                    <select value={settingsForm.project_template} onChange={e => setF('project_template', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all text-gray-700">
                      {PROJECT_TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Contract / PO #</label>
                      <input type="text" value={settingsForm.contract_po || ''} onChange={e => setF('contract_po', e.target.value)} placeholder="Contract / PO #"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Contract Expiration</label>
                      <input type="date" value={settingsForm.contract_expiration || ''} onChange={e => setF('contract_expiration', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all text-gray-700" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Wick&apos;d Contact</label>
                    <select value={settingsForm.wickd_contact_employee_id || ''} onChange={e => setF('wickd_contact_employee_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all text-gray-700 bg-white">
                      <option value="">Select from directory…</option>
                      {settingsEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}{emp.role ? ` · ${emp.role}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Project Superintendent</label>
                      <input type="text" value={settingsForm.superintendent_name || ''} onChange={e => setF('superintendent_name', e.target.value)} placeholder="Name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Superintendent Phone</label>
                      <input type="text" value={settingsForm.superintendent_phone || ''} onChange={e => setF('superintendent_phone', e.target.value)} placeholder="(205) 448-7740"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Location */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Location</h3>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Search Address</label>
                    <div className="relative">
                      <input type="text" value={settingsAddressQuery} onChange={e => setSettingsAddressQuery(e.target.value)} placeholder="Search for an address"
                        className="w-full pl-3 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all" />
                      {settingsSearching
                        ? <Loader2 className="w-4 h-4 text-[#FF6633] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                        : <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />}
                      {settingsAddressResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden divide-y divide-gray-50 max-h-48 overflow-y-auto">
                          {settingsAddressResults.map((r: any, i: number) => (
                            <button key={i} type="button" onClick={() => settingsSelectAddress(r)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              {r.display_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Street Address</label>
                    <input type="text" value={settingsForm.street_address} onChange={e => setF('street_address', e.target.value)} placeholder="Street address"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">City</label>
                      <input type="text" value={settingsForm.city} onChange={e => setF('city', e.target.value)} placeholder="City"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">State</label>
                      <input type="text" value={settingsForm.state} onChange={e => setF('state', e.target.value)} placeholder="State"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Zip Code</label>
                      <input type="text" value={settingsForm.zip_code} onChange={e => setF('zip_code', e.target.value)} placeholder="Zip"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Country</label>
                      <input type="text" value={settingsForm.country} onChange={e => setF('country', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Gate Code</label>
                    <input type="text" value={settingsForm.gate_code || ''} onChange={e => setF('gate_code', e.target.value)} placeholder="Site gate or access code"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all" />
                  </div>
                </div>
              </div>

              {/* Site survey questions (per project; mobile: GET /api/survey/templates?project_id=… or ?project=…) */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Site survey questions</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Each line is shown in the app with <span className="font-medium text-gray-700">Yes / No / N/A</span>.
                      Choose whether Yes or No is the green answer (optional — auto-fills from the question), and enable “Text description” to collect an extra note for that item.{' '}
                      <a href="/company/survey-questions" className="text-[#FF6633] hover:underline">
                        Edit company defaults
                      </a>{' '}
                      for all projects.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {surveyQuestionsSuccess && (
                      <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Survey questions saved
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={surveyQuestionsSaving || surveyQuestionsLoading}
                      onClick={saveSurveyQuestions}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-60"
                    >
                      {surveyQuestionsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save survey questions
                    </button>
                  </div>
                </div>
                <div className="px-6 py-5 space-y-4">
                  {surveyQuestionsError && (
                    <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {surveyQuestionsError}
                    </div>
                  )}
                  {surveyQuestionsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-7 h-7 animate-spin text-[#FF6633]" />
                    </div>
                  ) : (
                    <>
                      {surveyQuestionDrafts.length === 0 && (
                        <p className="text-sm text-gray-500">No questions yet. Add at least one for field staff to complete a site survey.</p>
                      )}
                      <div className="space-y-3">
                        {surveyQuestionDrafts.map((row, index) => (
                          <div
                            key={row.key}
                            className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 border border-gray-100 rounded-lg bg-gray-50/50"
                          >
                            <div className="flex items-center gap-1 sm:flex-col sm:pt-1 flex-shrink-0">
                              <button
                                type="button"
                                aria-label="Move up"
                                disabled={index === 0}
                                onClick={() => moveSurveyQuestion(index, -1)}
                                className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                aria-label="Move down"
                                disabled={index === surveyQuestionDrafts.length - 1}
                                onClick={() => moveSurveyQuestion(index, 1)}
                                className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Question</label>
                              <input
                                type="text"
                                value={row.question}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setSurveyQuestionDrafts((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? { ...r, question: v, positive_answer: inferPositiveAnswer(v) }
                                        : r
                                    )
                                  );
                                }}
                                placeholder="e.g. Is the work area free of trip hazards?"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633]"
                              />
                              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={row.requires_text_description}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSurveyQuestionDrafts((prev) =>
                                      prev.map((r, i) => (i === index ? { ...r, requires_text_description: checked } : r))
                                    );
                                  }}
                                  className="rounded border-gray-300 text-[#FF6633] focus:ring-[#FF6633]"
                                />
                                <span className="text-sm text-gray-700">Require text description (in addition to Yes / No / N/A)</span>
                              </label>
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                  Green answer <span className="font-normal normal-case text-gray-400">(optional)</span>
                                </label>
                                <select
                                  value={row.positive_answer}
                                  onChange={(e) => {
                                    const positive_answer = e.target.value === 'No' ? 'No' : 'Yes';
                                    setSurveyQuestionDrafts((prev) =>
                                      prev.map((r, i) => (i === index ? { ...r, positive_answer } : r))
                                    );
                                  }}
                                  className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633]"
                                >
                                  <option value="Yes">Yes is green</option>
                                  <option value="No">No is green</option>
                                </select>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setSurveyQuestionDrafts((prev) => prev.filter((_, i) => i !== index))
                              }
                              className="self-start p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              aria-label="Remove question"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSurveyQuestionDrafts((prev) => [
                            ...prev,
                            {
                              key: `draft-${crypto.randomUUID()}`,
                              question: '',
                              requires_text_description: false,
                              positive_answer: inferPositiveAnswer(''),
                            },
                          ])
                        }
                        className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-[#FF6633] hover:text-[#FF6633] transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add question
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Danger zone */}
              <div className="bg-white rounded-xl border border-red-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-red-100">
                  <h3 className="text-sm font-semibold text-red-700">Danger Zone</h3>
                </div>
                <div className="px-6 py-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Delete this project</p>
                    <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone. All associated data will be permanently removed.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${settingsProject?.name}"? This cannot be undone.`)) {
                        fetch(`/api/projects/${settingsProject?.id}`, { method: 'DELETE' })
                          .then(() => {
                            invalidateDashboardCacheKey(PROJECTS_RAW_CACHE_KEY);
                            window.location.href = '/projects';
                          })
                          .catch(() => alert('Delete failed'));
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete project
                  </button>
                </div>
              </div>
            </div>
          </form>
          )}
        </div>
      </div>
    );
  }

  // Handle Gallery Rendering (Simplified Reference Style)
  if (dataType === 'gallery') {
    const galleryTz = getActivityDisplayTimeZone();
    const allPhotos = data.flatMap(item => 
      (item.photos || []).map((url: string) => {
        const urlNorm = normalizeRemotePhotoUrl(
          typeof url === 'string' ? url : String((url as { secure_url?: string })?.secure_url || (url as { url?: string })?.url || '')
        );
        const instant = item.isoTimestamp ? new Date(item.isoTimestamp) : null;
        const dateObj =
          instant && !Number.isNaN(instant.getTime())
            ? instant
            : new Date(String(item.timestamp).replace(' at ', ' '));
        const isoDate =
          instant && !Number.isNaN(instant.getTime())
            ? formatYmdInTimeZone(instant, galleryTz)
            : String(item.timestamp).split(' at ')[0]?.split('|')[0]?.trim() || '';
        const monthYear =
          instant && !Number.isNaN(instant.getTime())
            ? new Intl.DateTimeFormat('en-US', {
                timeZone: galleryTz,
                month: 'short',
                year: 'numeric',
              })
                .format(instant)
                .toUpperCase()
            : format(dateObj, 'MMM yyyy').toUpperCase();
        return {
          url: urlNorm,
          uploadedBy: item.employeeName,
          date: item.timestamp,
          isoDate,
          monthYear,
          project: item.project,
          description: item.metrics?.find((m: any) => m.label?.toLowerCase().includes('note') || m.label?.toLowerCase().includes('desc'))?.value || 'Uploaded in ' + item.activityType,
          fileName: urlNorm.split('/').pop()?.split('?')[0] || 'img_asset.jpg',
          isFavorite: false, // Mock state
          tags: Array.isArray(item.tags) ? item.tags as string[] : [],
          sourceId: item.id,
          sourceType: item.activityType,
        };
      }).filter((p: { url: string }) => p.url && isBrowserResolvableUrl(p.url))
    );

    const availableTags = Array.from(
      new Set(allPhotos.flatMap((p) => (Array.isArray(p.tags) ? p.tags : [])).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    const toggleGalleryTag = (tag: string) => {
      setGallerySelectedTags((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
      );
    };

    const filteredPhotos = allPhotos.filter((p) => {
      if (gallerySelectedTags.length > 0) {
        const photoTags = (p.tags || []).map((t: string) => t.toLowerCase());
        const matchesTag = gallerySelectedTags.some((t) => photoTags.includes(t.toLowerCase()));
        if (!matchesTag) return false;
      }
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        p.fileName.toLowerCase().includes(q) ||
        p.uploadedBy?.toLowerCase().includes(q) ||
        (p.tags && p.tags.some((t: string) => t.toLowerCase().includes(q)))
      );
    });

    const groups: { [key: string]: any[] } = {};
    filteredPhotos.forEach(p => {
      const g = p.monthYear;
      if (!groups[g]) groups[g] = [];
      groups[g].push(p);
    });

    const sortedGroups = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return (
      <div className="h-full flex flex-col bg-white flex-1 overflow-hidden">
        {/* Top Header: Tabs and Stats */}
        <div className="px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="px-4 py-1.5 bg-gray-800 text-white text-xs font-bold rounded-md">All</button>
            <button className="px-4 py-1.5 bg-white text-gray-500 text-xs font-bold rounded-md border border-gray-100 hover:bg-gray-50 transition-colors">Favorites</button>
          </div>
          <div className="flex items-center gap-6 text-[12px] font-bold text-gray-400">
            <div className="flex items-center gap-2 font-black leading-none"><span className="text-gray-900 text-lg">{filteredPhotos.length}</span> PHOTOS</div>
            <div className="flex items-center gap-2 font-black leading-none"><span className="text-gray-900 text-lg">0</span> VIDEOS</div>
            <div className="flex items-center gap-2 font-black leading-none"><span className="text-gray-900 text-lg">0</span> DOCUMENTS</div>
            <div className="flex items-center gap-2 font-black leading-none"><span className="text-gray-900 text-lg">0</span> AUDIO</div>
          </div>
        </div>

        {/* Toolbar: Filters and Search */}
        <div className="px-8 pb-4 flex items-center gap-3 relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setGalleryFiltersOpen((o) => !o)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-md text-xs font-bold transition-colors ${
                gallerySelectedTags.length > 0 || galleryFiltersOpen
                  ? "border-[#FF6633]/40 bg-orange-50 text-[#FF6633]"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              Tags
              {gallerySelectedTags.length > 0 ? (
                <span className="ml-0.5 rounded-full bg-[#FF6633] px-1.5 py-0.5 text-[10px] font-black text-white">
                  {gallerySelectedTags.length}
                </span>
              ) : null}
            </button>
            {galleryFiltersOpen ? (
              <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-700">Filter by tag</p>
                  {gallerySelectedTags.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setGallerySelectedTags([])}
                      className="text-[10px] font-bold text-[#FF6633] hover:underline"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                {availableTags.length === 0 ? (
                  <p className="text-xs text-gray-400">No tags on photos yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                    {availableTags.map((tag) => {
                      const active = gallerySelectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleGalleryTag(tag)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-colors ${
                            active
                              ? "bg-[#FF6633] text-white border-[#FF6633]"
                              : "bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <div className="relative flex-1 max-w-sm group">
             <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
             <input 
               type="text" 
               placeholder="Search by name, uploader, or tag…" 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-black"
             />
          </div>
          <button className="p-2 border border-gray-200 rounded-md hover:bg-gray-50 text-gray-500">
             <Plus className="w-4 h-4" />
          </button>
        </div>

        {gallerySelectedTags.length > 0 ? (
          <div className="px-8 pb-4 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Active tags</span>
            {gallerySelectedTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleGalleryTag(tag)}
                className="inline-flex items-center gap-1 rounded-full bg-[#FF6633] px-2.5 py-1 text-[11px] font-semibold text-white"
              >
                {tag}
                <X className="w-3 h-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setGallerySelectedTags([])}
              className="text-[11px] font-bold text-gray-400 hover:text-gray-600"
            >
              Clear all
            </button>
          </div>
        ) : null}

        <div className="flex-1 overflow-auto p-8 pt-4">
          {filteredPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Tag className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm font-semibold text-gray-500">No photos match these filters</p>
              {(searchQuery || gallerySelectedTags.length > 0) ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setGallerySelectedTags([]);
                  }}
                  className="mt-3 text-xs font-bold text-[#FF6633] hover:underline"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
          <>
          {sortedGroups.map(groupName => (
            <div key={groupName} className="mb-10">
              <h3 className="text-sm font-bold text-gray-400 mb-6 tracking-wide">{groupName}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {groups[groupName].map((photo, index) => (
                  <div 
                    key={index} 
                    className="group flex flex-col bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setViewerState({ isOpen: true, index: filteredPhotos.indexOf(photo), list: filteredPhotos })}
                  >
                    <div className="aspect-square relative flex-shrink-0">
                      <NextImage 
                        src={photo.url} 
                        alt="Gallery item"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 20vw"
                      />
                    </div>
                    <div className="p-3 bg-white border-t border-gray-50">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium text-gray-600 truncate flex-1">{photo.fileName}</p>
                        <button className="ml-2 text-gray-300 hover:text-yellow-400 transition-colors">
                           <Star className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {photo.tags && photo.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {photo.tags.map((tag: string, ti: number) => (
                            <button
                              key={ti}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleGalleryTag(tag);
                                setGalleryFiltersOpen(false);
                              }}
                              className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors cursor-pointer ${
                                gallerySelectedTags.includes(tag)
                                  ? "bg-[#FF6633] text-white border-[#FF6633]"
                                  : "bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100"
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          </>
          )}
        </div>

        <ImageViewer 
          isOpen={viewerState.isOpen}
          photos={viewerState.list.map((p: any) => p.url)}
          initialIndex={viewerState.index}
          onClose={() => setViewerState({ ...viewerState, isOpen: false })}
          metadata={viewerState.list[viewerState.index]}
          onPhotoDeleted={handleProjectPhotoDeleted}
          onTagsChanged={handleAttachmentTagsChanged}
        />
      </div>
    );
  }

  // Handle Specialized Insights Dashboard (Graphs)
  if (dataType === 'activity') {
    return (
      <div className="h-full flex flex-col bg-[#F8F9FB] flex-1 overflow-hidden uppercase-sidebar-fix">
        {/* Senior Designer Level Integrated Toolbar */}
        <div className="px-8 py-3 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm relative z-20">
            {/* LEFT: PRIMARY SELECTION (PROJECT) */}
            <div className="flex items-center gap-4">
                <div className="relative">
                   <div className="flex flex-col mb-1">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Primary Scope</span>
                   </div>
                   <button 
                     onClick={() => setProjectOpen(!projectOpen)}
                     className="group flex items-center gap-3 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all border border-gray-200/50 hover:border-[#FF6633]/30 shadow-sm"
                   >
                      <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                        <Briefcase className="w-4 h-4 text-[#FF6633]" />
                      </div>
                      <div className="flex flex-col items-start pr-2">
                         <span className="text-[14px] font-black text-gray-900 leading-none">{selectedProject}</span>
                         <span className="text-[10px] text-gray-500 font-bold mt-1 opacity-70">Switch Context</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${projectOpen ? 'rotate-180' : ''}`} />
                   </button>

                   {projectOpen && (
                     <div className="absolute top-16 left-0 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 z-50">
                        <div className="px-5 py-2 mb-1">
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Available Projects</span>
                        </div>
                        {visibleProjectsList.map(p => (
                          <button
                            key={p}
                            onClick={() => { setSelectedProject(p); setProjectOpen(false); }}
                            className={`w-full text-left px-5 py-3 text-[13px] hover:bg-gray-50 flex items-center justify-between transition-colors ${selectedProject === p ? 'text-[#FF6633] font-black bg-[#FFF3EF]' : 'text-gray-600 font-medium'}`}
                          >
                            {p}
                            {selectedProject === p && <CheckCircle2 className="w-4 h-4 text-[#FF6633]" />}
                          </button>
                        ))}
                     </div>
                   )}
                </div>

                <div className="h-10 w-[1px] bg-gray-200 hidden md:block" />

                {/* CENTER: ANALYTICAL WINDOW (QUICK TOGGLES) */}
                <div className="flex flex-col">
                   <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-1">Time Segment</span>
                   <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-2xl border border-gray-200/50">
                      {(['7d', '30d', 'all', 'custom'] as const).map(range => (
                        <button
                          key={range}
                          onClick={() => setTimeRange(range)}
                          className={`px-5 py-2 text-[12px] font-black rounded-xl transition-all duration-200 ${timeRange === range ? 'bg-white text-[#FF6633] shadow-md scale-[1.02]' : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'}`}
                        >
                          {range === '7d' ? '7D' : range === '30d' ? '30D' : range === 'all' ? 'Full Scope' : 'Custom'}
                        </button>
                      ))}
                   </div>
                </div>
            </div>

            {/* RIGHT: DATA RANGE / PERIOD DISPLAY */}
            <div className="flex items-end flex-col gap-1">
               <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest pr-1">Active Range</span>
               {timeRange === 'custom' ? (
                 <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border-2 border-[#FF6633]/20 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex flex-col group/date">
                       <input 
                         type="date" 
                         value={startDate} 
                         onChange={(e) => setStartDate(e.target.value)}
                         className="bg-transparent border-none p-0 text-[13px] font-black text-gray-900 focus:ring-0 cursor-pointer"
                       />
                       <span className="text-[8px] font-black text-[#FF6633] uppercase">Start Window</span>
                    </div>
                    <div className="flex items-center text-gray-300">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col group/date">
                       <input 
                         type="date" 
                         value={endDate} 
                         onChange={(e) => setEndDate(e.target.value)}
                         className="bg-transparent border-none p-0 text-[13px] font-black text-gray-900 focus:ring-0 cursor-pointer"
                       />
                       <span className="text-[8px] font-black text-[#FF6633] uppercase">End Window</span>
                    </div>
                 </div>
               ) : (
                 <div className="flex items-center gap-3 bg-gray-50 px-5 py-2.5 rounded-2xl border border-gray-200 group cursor-default transition-all hover:bg-white hover:shadow-md">
                    <div className="p-1.5 bg-white rounded-lg shadow-sm">
                       <Calendar className="w-4 h-4 text-[#FF6633]" />
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[14px] font-black text-gray-900 leading-none">{format(selectedDate, "MMMM yyyy")}</span>
                       <span className="text-[10px] text-gray-500 font-bold mt-1">Summary Snapshot</span>
                    </div>
                 </div>
               )}
            </div>
        </div>

        <div className="flex-1 overflow-auto p-8">
           {loading ? (
             <div className="flex items-center justify-center h-full py-20">
               <Loader2 className="w-10 h-10 animate-spin text-[#FF6633]" />
             </div>
           ) : data.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-24 text-center">
               <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Icon className="w-10 h-10 text-gray-300" />
               </div>
               <h3 className="text-xl font-bold text-gray-900 mb-2">No insights for this period</h3>
               <p className="text-gray-500 text-sm max-w-[280px] mx-auto">
                 Try expanding the time range or selecting a different date to see analytical records.
               </p>
             </div>
           ) : (
             <div className="max-w-6xl mx-auto space-y-8 pb-12">
               {/* Summary Stats */}
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 {[
                   { label: 'Total Logs', value: data.length, icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50' },
                   { label: 'Key Metrics', value: data.reduce((acc, curr) => acc + (curr.metrics?.length || 0), 0), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
                   { label: 'Visual Checks', value: data.filter(d => d.photos?.length).length, icon: ImageIcon, color: 'text-purple-600', bg: 'bg-purple-50' },
                   { label: 'Safety Issues', value: data.filter(d => d.activityType === 'Incidents').length, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
                 ].map((stat, i) => (
                   <div key={i} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
                     <div className="flex items-center justify-between mb-4">
                       <div className={`p-2.5 ${stat.bg} ${stat.color} rounded-xl`}>
                         <stat.icon className="w-5 h-5" />
                       </div>
                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Project Snapshot</span>
                     </div>
                     <p className="text-2xl font-black text-gray-900">{stat.value}</p>
                     <p className="text-[13px] text-gray-500 font-medium mt-0.5">{stat.label}</p>
                   </div>
                 ))}
               </div>

               {/* Charts Container */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Bar Chart: Activity Distro */}
                 <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                   <div className="flex items-center justify-between mb-8">
                     <div>
                       <h3 className="text-lg font-bold text-gray-900 tracking-tight">Record Distribution</h3>
                       <p className="text-xs text-gray-500 mt-1 font-medium">Breakdown by activity type</p>
                     </div>
                     <div className="p-2 bg-gray-50 rounded-lg">
                       <BarChartIcon className="w-4 h-4 text-gray-400" />
                     </div>
                   </div>
                   <div className="h-[280px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={insightsMetrics?.chartData}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                         <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 11, fontWeight: 500, fill: '#94a3b8' }}
                            dy={10}
                         />
                         <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 11, fontWeight: 500, fill: '#94a3b8' }} 
                         />
                         <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                         />
                         <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                           {insightsMetrics?.chartData.map((_entry: any, index: number) => (
                             <Cell key={`cell-${index}`} fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                           ))}
                         </Bar>
                       </BarChart>
                     </ResponsiveContainer>
                   </div>
                 </div>

                 {/* Area Chart: Activity Trend */}
                 <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                   <div className="flex items-center justify-between mb-8">
                     <div>
                       <h3 className="text-lg font-bold text-gray-900 tracking-tight">Activity Momentum</h3>
                       <p className="text-xs text-gray-500 mt-1 font-medium">Daily record count trends</p>
                     </div>
                     <div className="p-2 bg-indigo-50 rounded-lg">
                       <TrendingUp className="w-4 h-4 text-indigo-500" />
                     </div>
                   </div>
                   <div className="h-[280px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={insightsMetrics?.trendData}>
                         <defs>
                           <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                             <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                           </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                         <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 11, fontWeight: 500, fill: '#94a3b8' }}
                            dy={10}
                         />
                         <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 11, fontWeight: 500, fill: '#94a3b8' }} 
                         />
                         <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                         />
                         <Area 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#6366f1" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorCount)" 
                         />
                       </AreaChart>
                     </ResponsiveContainer>
                   </div>
                 </div>
               </div>

               {/* Detailed Logs List */}
               <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10 font_title">
                    <h4 className="text-[14px] font-black text-gray-900 uppercase tracking-widest">Core Insight Records</h4>
                    <span className="text-[12px] text-gray-400 font-medium">{data.length} entries</span>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-[600px] overflow-auto">
                    {data.slice(0, 50).map((item, idx) => (
                      <div key={item.id || idx} className="p-6 hover:bg-gray-50 transition-colors group">
                         <div className="flex items-start justify-between">
                            <div className="flex gap-4">
                               <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0">
                                 {item.employeeName?.charAt(0)}
                               </div>
                               <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[15px] font-bold text-gray-900">{item.employeeName}</span>
                                    <span className="px-2 py-0.5 bg-gray-100 text-[10px] font-black text-gray-500 rounded uppercase tracking-wider">{item.activityType}</span>
                                  </div>
                                  <p className="text-[14px] text-gray-600 leading-relaxed max-w-2xl">
                                    {item.action || item.metrics?.[0]?.value || 'Insight data record'}
                                  </p>
                                  <div className="flex items-center gap-4 mt-3">
                                     <div className="flex items-center gap-1.5 text-[12px] text-gray-400 font-medium">
                                        <Clock className="w-3.5 h-3.5" />
                                        {item.isoTimestamp
                                          ? formatMonthDayTimeInTimeZone(item.isoTimestamp)
                                          : String(item.timestamp)}
                                     </div>
                                     {item.photos?.length > 0 && (
                                       <div className="flex items-center gap-1.5 text-[12px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                                          <ImageIcon className="w-3.5 h-3.5" />
                                          {item.photos.length} visual confirms
                                       </div>
                                     )}
                                  </div>
                               </div>
                            </div>
                            <button className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <MoreHorizontal className="w-5 h-5 text-gray-400" />
                            </button>
                         </div>
                      </div>
                    ))}
                  </div>
               </div>
             </div>
           )}
        </div>
      </div>
    );
  }
  // ─── Directory Dashboard ───
  if (dataType === 'directory') {
    return <DirectoryScreen projectFilter={selectedProject} />;
  }

  // ─── Notes Dashboard ───
  if (dataType === 'notes') {
    return (
      <div className="h-full flex flex-col bg-gray-50 flex-1 overflow-hidden">
        <div className="px-8 py-5 bg-white border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Notes</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {format(selectedDate, 'EEEE, MMMM d yyyy')} · {notesData.length} log{notesData.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex-1 overflow-auto px-8 py-6">
          {notesLoading ? (
            <div className="flex justify-center h-48 items-center"><Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" /></div>
          ) : notesData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <MessageSquare className="w-10 h-10 text-gray-200" />
              <p className="text-sm font-medium">No notes for this date</p>
            </div>
          ) : (
            <div className="space-y-6">
              {notesData.map((note, idx) => (
                <div key={note.id || idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden hidden-shadow hover:shadow-md transition-shadow">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-[#FF6633]/10 flex items-center justify-center text-[#FF6633] font-bold text-sm">{idx + 1}</div>
                       <div className="flex flex-col">
                         <span className="text-sm font-semibold text-gray-900">{note.category ? `${note.category} note` : 'General note'}</span>
                         {note.logged_at && (
                           <span className="text-xs text-gray-400">
                             {(() => {
                               const submitted = formatHmAmInTimeZone(String(note.logged_at));
                               const reportYmd = resolveRowReportDateYmd(note as Record<string, unknown>);
                               const submitYmd = loggedAtYmd(note as Record<string, unknown>);
                               if (reportYmd && submitYmd && reportYmd !== submitYmd) {
                                 const uploaded = format(new Date(`${submitYmd}T12:00:00`), 'MMM d, yyyy');
                                 const reportDay = format(new Date(`${reportYmd}T12:00:00`), 'MMM d, yyyy');
                                 return `${submitted} · Uploaded ${uploaded} · Report day ${reportDay}`;
                               }
                               return submitted;
                             })()}
                           </span>
                         )}
                       </div>
                    </div>
                    {note.category && (
                      <span className="px-3 py-1 bg-gray-100 rounded-full text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                        {note.category}
                      </span>
                    )}
                  </div>
                  <div className="px-6 py-5">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{note.notes_text}</p>
                  </div>
                  {note.photos && note.photos.length > 0 && (
                    <div className="px-6 pb-5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Photos</p>
                      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
                        {note.photos.map((url: string, pi: number) => (
                           <div key={pi} className="aspect-square relative rounded-lg overflow-hidden border border-gray-100 cursor-pointer"
                                onClick={() => setViewerState({ isOpen: true, index: pi, list: note.photos.map((u: string) => ({url: u})) })}>
                             <NextImage src={url} alt={`Photo ${pi + 1}`} fill className="object-cover" />
                           </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <ImageViewer
          isOpen={viewerState.isOpen}
          photos={viewerState.list.map((p: any) => p.url)}
          initialIndex={viewerState.index}
          onClose={() => setViewerState({ ...viewerState, isOpen: false })}
          metadata={viewerState.list[viewerState.index]}
        />
      </div>
    );
  }

  // ─── Survey Dashboard ───
  if (dataType === 'survey') {
    return (
      <div className="h-full flex flex-col bg-gray-50 flex-1 overflow-hidden">
        <div className="px-8 py-5 bg-white border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Survey</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {format(selectedDate, 'EEEE, MMMM d yyyy')} · {surveyData.length} log{surveyData.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex-1 overflow-auto px-8 py-6">
          {surveyLoading ? (
            <div className="flex justify-center h-48 items-center"><Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" /></div>
          ) : surveyData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <ClipboardList className="w-10 h-10 text-gray-200" />
              <p className="text-sm font-medium">No survey logs for this date</p>
            </div>
          ) : (
            <div className="space-y-6">
              {surveyData.map((survey, idx) => (
                <div key={survey.id || idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden hidden-shadow hover:shadow-md transition-shadow">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-[#FF6633]/10 flex items-center justify-center text-[#FF6633] font-bold text-sm">{idx + 1}</div>
                       <div className="flex flex-col">
                         <span className="text-sm font-semibold text-gray-900">Survey Completed</span>
                         {survey.logged_at && <span className="text-xs text-gray-400">{formatHmAmInTimeZone(String(survey.logged_at))}</span>}
                       </div>
                    </div>
                  </div>
                  {survey.questions && survey.questions.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {survey.questions.map((q: any, qi: number) => (
                        <div key={qi} className="px-6 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900 mb-1">{q.question}</p>
                              {q.description && <p className="text-sm text-gray-500 italic mt-1">{q.description}</p>}
                            </div>
                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap ${
                              q.answer === 'Yes' ? 'bg-green-50 text-green-700 border-green-200' : 
                              q.answer === 'No' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-gray-100 text-gray-600 border-gray-200'
                            }`}>{q.answer || 'N/A'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                     <div className="px-6 py-4 text-sm text-gray-400 italic">No questions found.</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Observations Dashboard (open site conditions; no date filter) ───
  if (dataType === 'observations') {
    const markResolved = async (id: string) => {
      const prev = observationsData;
      setObservationsData(prev.filter((o: { id?: string }) => o.id !== id));
      try {
        const res = await fetch('/api/observations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: 'Resolved' }),
        });
        if (!res.ok) {
          setObservationsData(prev);
          writeDashboardCache(observationsCacheKey, prev);
          return;
        }
        writeDashboardCache(
          observationsCacheKey,
          prev.filter((o: { id?: string }) => o.id !== id)
        );
      } catch {
        setObservationsData(prev);
        writeDashboardCache(observationsCacheKey, prev);
      }
    };

    return (
      <div className="h-full flex flex-col bg-gray-50 flex-1 overflow-hidden">
        <div className="px-8 py-5 bg-white border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Open Observations</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {observationsData.length} open item{observationsData.length !== 1 ? 's' : ''} · mark resolved when addressed
          </p>
        </div>
        <div className="flex-1 overflow-auto px-8 py-6">
          {observationsLoading ? (
            <div className="flex justify-center h-48 items-center"><Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" /></div>
          ) : observationsData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <Eye className="w-10 h-10 text-gray-200" />
              <p className="text-sm font-medium">No open observations</p>
            </div>
          ) : (
            <div className="space-y-6">
              {observationsData.map((obs, idx) => {
                const descriptionText = resolveObservationDescription({
                  description: obs.description,
                  description_tags: obs.description_tags,
                });
                return (
                <div key={obs.id || idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden hidden-shadow hover:shadow-md transition-shadow">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-start gap-4 bg-gray-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                       <div className="w-8 h-8 rounded-full bg-[#FF6633]/10 flex items-center justify-center text-[#FF6633] font-bold text-sm flex-shrink-0">{idx + 1}</div>
                       <div className="flex flex-col min-w-0">
                         <span className="text-sm font-semibold text-gray-900 truncate">{obs.title || obs.type || 'Observation'}</span>
                         <span className="text-xs text-gray-400">
                           {obs.type || 'Site condition'}
                           {obs.logged_at ? ` · ${formatHmAmInTimeZone(String(obs.logged_at))}` : ''}
                         </span>
                       </div>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end items-center flex-shrink-0">
                       {obs.progress && (
                         <span className="px-2.5 py-1 rounded border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                           {obs.progress}
                         </span>
                       )}
                       <span className="px-2.5 py-1 rounded border border-red-200 bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-wider">
                         Open
                       </span>
                       <button
                         type="button"
                         onClick={() => obs.id && markResolved(String(obs.id))}
                         className="px-3 py-1.5 rounded-lg bg-[#FF6633] text-white text-[11px] font-semibold hover:bg-[#E55A2B] transition-colors"
                       >
                         Mark resolved
                       </button>
                    </div>
                  </div>
                  <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">Description</p>
                      {descriptionText ? (
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{descriptionText}</p>
                      ) : (
                        <p className="text-sm text-gray-400">—</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">Location</p>
                      <p className="text-sm text-gray-800 mb-2">{obs.location || '—'}</p>
                      {obs.gps_lat != null && obs.gps_lng != null && (
                        <p className="text-xs text-gray-500">
                          GPS {Number(obs.gps_lat).toFixed(5)}, {Number(obs.gps_lng).toFixed(5)}
                        </p>
                      )}
                    </div>
                  </div>
                  {((Array.isArray(obs.attachments) && obs.attachments.length > 0) ||
                    (Array.isArray(obs.resolution_photos) && obs.resolution_photos.length > 0)) && (
                    <div className="px-6 pb-5">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">Photos</p>
                      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
                        {[...(obs.attachments || []), ...(obs.resolution_photos || [])].map((url: string, pi: number) => (
                           <div key={pi} className="aspect-square relative rounded-lg overflow-hidden border border-gray-100 cursor-pointer"
                                onClick={() => setViewerState({ isOpen: true, index: pi, list: [...(obs.attachments || []), ...(obs.resolution_photos || [])].map((u: string) => ({url: u})) })}>
                             <NextImage src={url} alt={`Photo ${pi + 1}`} fill className="object-cover" />
                           </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
        <ImageViewer
          isOpen={viewerState.isOpen}
          photos={viewerState.list.map((p: any) => p.url)}
          initialIndex={viewerState.index}
          onClose={() => setViewerState({ ...viewerState, isOpen: false })}
          metadata={viewerState.list[viewerState.index]}
        />
      </div>
    );
  }

  // ─── Safety talks (project + selected date) ───
  if (dataType === 'safety-talks') {
    return (
      <div className="h-full flex flex-col bg-gray-50 flex-1 overflow-hidden">
        <div className="px-8 py-5 bg-white border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Safety talks</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {format(selectedDate, 'EEEE, MMMM d yyyy')} · {safetyTalksData.length} event
            {safetyTalksData.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex-1 overflow-auto px-8 py-6">
          {safetyTalksLoading ? (
            <div className="flex justify-center h-48 items-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" />
            </div>
          ) : safetyTalksData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <Clipboard className="w-10 h-10 text-gray-200" />
              <p className="text-sm font-medium">No safety talks for this date</p>
            </div>
          ) : (
            <div className="space-y-8">
              {safetyTalksByDate.map(({ date, talks }) => (
                <section key={date}>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                    {format(new Date(`${date}T12:00:00`), 'EEEE, MMMM d yyyy')}
                    <span className="ml-2 font-semibold text-gray-400 normal-case tracking-normal">
                      · {talks.length} talk{talks.length !== 1 ? 's' : ''}
                    </span>
                  </h3>
                  <div className="space-y-4">
                    {talks.map((t: any, idx: number) => {
                const completed = isSafetyTalkCompletedStatus(t.status);
                const when = t.completed_at || t.created_at;
                const attendeeList = Array.isArray(t.attendees) ? t.attendees : [];
                const attendeeCount =
                  typeof t.attendee_count === 'number' ? t.attendee_count : attendeeList.length;
                return (
                  <div
                    key={t.id || idx}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
                  >
                    <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3 bg-white">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-700 flex-shrink-0">
                          <Clipboard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{t.template_name || 'Safety talk'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{t.project_name}</p>
                          {t.scheduled_date && (
                            <p className="text-[11px] text-gray-400 mt-1">
                              Scheduled{' '}
                              <span className="font-medium text-gray-600">{t.scheduled_date}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {completed ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Conducted
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                            {t.status || 'Scheduled'}
                          </span>
                        )}
                        {when && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatHmAmInTimeZone(String(when))}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-6 py-3 border-t border-gray-100 bg-white">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
                        Attendees ({attendeeCount})
                      </p>
                      {attendeeList.length > 0 ? (
                        <ul className="space-y-1.5">
                          {attendeeList.map((a: { id: string; name: string; company?: string }) => (
                            <li key={a.id} className="text-sm text-gray-800 flex flex-wrap items-baseline gap-x-2">
                              <span className="font-medium">{a.name}</span>
                              {a.company ? (
                                <span className="text-xs text-gray-500">· {a.company}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-400">No attendees recorded for this session.</p>
                      )}
                    </div>
                    <div className="px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 bg-gray-50/50">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Topic (library)
                        </span>
                        {t.pdf_url ? (
                          <a
                            href={t.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-[#2196F3] hover:underline"
                          >
                            View topic PDF
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Session record
                        </span>
                        {t.attendance_pdf_url ? (
                          <a
                            href={t.attendance_pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-emerald-700 hover:underline"
                          >
                            View attended talk PDF
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">Not uploaded</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Incidents Dashboard ───
  if (dataType === 'incidents') {
    return (
      <div className="h-full flex flex-col bg-gray-50 flex-1 overflow-hidden">
        <div className="px-8 py-5 bg-white border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Incidents</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {format(selectedDate, 'EEEE, MMMM d yyyy')} · {incidentsData.length} log{incidentsData.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex-1 overflow-auto px-8 py-6">
          {incidentsLoading ? (
            <div className="flex justify-center h-48 items-center"><Loader2 className="w-8 h-8 animate-spin text-[#FF6633]" /></div>
          ) : incidentsData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <AlertTriangle className="w-10 h-10 text-gray-200" />
              <p className="text-sm font-medium">No incidents reported for this date</p>
            </div>
          ) : (
            <div className="space-y-6">
              {incidentsData.map((inc, idx) => (
                <div key={inc.id || idx} className="bg-white rounded-xl border border-red-200 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-red-100 flex justify-between items-center bg-red-50/50">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm"><AlertTriangle className="w-4 h-4" /></div>
                       <div className="flex flex-col">
                         <span className="text-sm font-bold text-gray-900">{inc.title || 'Incident Report'}</span>
                         {inc.logged_at && <span className="text-xs text-gray-500">{formatHmAmInTimeZone(String(inc.logged_at))}</span>}
                       </div>
                    </div>
                    <div className="flex gap-2">
                       {inc.recordable !== undefined && (
                         <span className={`px-2.5 py-1 rounded font-bold text-[10px] uppercase tracking-wider ${
                           inc.recordable ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                         }`}>{inc.recordable ? 'Recordable' : 'Non-Recordable'}</span>
                       )}
                       {inc.status && (
                         <span className={`px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${
                           inc.status === 'Open' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                         }`}>{inc.status}</span>
                       )}
                    </div>
                  </div>
                  <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">Description & Location</p>
                      <p className="text-sm text-gray-800 mb-2 whitespace-pre-wrap">{inc.description || '—'}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1.5 font-medium"><MapPin className="w-3.5 h-3.5" />{inc.location || 'Unknown location'}</p>
                    </div>
                    {(inc.injury_illness_type || (inc.injured_employee_info && inc.injured_employee_info.length > 0)) && (
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">Affected individuals</p>
                        {inc.injury_illness_type && (
                          <p className="text-xs font-semibold text-red-600 mb-2 px-2 py-1 bg-red-50 inline-block border border-red-100 rounded">{inc.injury_illness_type}</p>
                        )}
                        {inc.injured_employee_info && inc.injured_employee_info.length > 0 && (
                          <ul className="text-sm text-gray-800 list-disc list-inside space-y-1">
                            {inc.injured_employee_info.map((emp: string, i: number) => <li key={i}>{emp}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                  {inc.photos && inc.photos.length > 0 && (
                    <div className="px-6 pb-5 border-t border-red-50 pt-4">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">Incident Photos</p>
                      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
                        {inc.photos.map((url: string, pi: number) => (
                           <div key={pi} className="aspect-square relative rounded-lg overflow-hidden border border-gray-200 cursor-pointer"
                                onClick={() => setViewerState({ isOpen: true, index: pi, list: inc.photos.map((u: string) => ({url: u})) })}>
                             <NextImage src={url} alt={`Photo ${pi + 1}`} fill className="object-cover" />
                           </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <ImageViewer
          isOpen={viewerState.isOpen}
          photos={viewerState.list.map((p: any) => p.url)}
          initialIndex={viewerState.index}
          onClose={() => setViewerState({ ...viewerState, isOpen: false })}
          metadata={viewerState.list[viewerState.index]}
        />
      </div>
    );
  }

  // Specialized rendering for Attachments module (File Card Grid)
  if (dataType === 'attachments') {
    const files = data.flatMap(item => 
      (item.photos || []).map((url: string) => {
        const urlNorm = normalizeRemotePhotoUrl(
          typeof url === 'string' ? url : String((url as { secure_url?: string })?.secure_url || (url as { url?: string })?.url || '')
        );
        return {
          url: urlNorm,
          fileName: urlNorm.split('/').pop()?.split('?')[0] || 'Untitled File',
          uploadedBy: item.employeeName,
          date: item.timestamp,
          project: item.project,
          description: item.metrics?.find((m: any) => m.label?.toLowerCase().includes('note'))?.value
        };
      }).filter((f: { url: string }) => f.url && isBrowserResolvableUrl(f.url))
    );

    return (
      <div className="h-full flex flex-col bg-gray-50 flex-1 overflow-hidden">
        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
           <div className="text-xs text-gray-400 font-medium">
             Drag and drop files below or <span className="text-[#2196F3] cursor-pointer">select files</span>. The file size limit is 60MB.
           </div>
        </div>

        <div className="flex-1 overflow-auto p-8 pt-4">
          {loading ? (
             <div className="flex py-20 justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
             </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Icon className="w-10 h-10 text-gray-300" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">No attachments found</h2>
              <p className="text-gray-500 max-w-[280px] mx-auto text-sm">
                There are currently no recorded attachments for this project period.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {files.map((file, idx) => (
                <div 
                  key={idx} 
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:border-[#2196F3] transition-all cursor-pointer group"
                  onClick={() => setViewerState({ isOpen: true, index: idx, list: files })}
                >
                  <div className="aspect-square relative transition-transform duration-300 group-hover:scale-[1.02]">
                    <NextImage src={file.url} alt={file.fileName} fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                  </div>
                  <div className="p-3 bg-white border-t border-gray-100">
                    <p className="text-[13px] font-medium text-gray-700 truncate">{file.fileName}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{file.date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ImageViewer 
          isOpen={viewerState.isOpen}
          photos={viewerState.list.map((f: any) => f.url)}
          initialIndex={viewerState.index}
          onClose={() => setViewerState({ ...viewerState, isOpen: false })}
          metadata={viewerState.list[viewerState.index]}
        />
      </div>
    );
  }

  // Handle List Rendering (Table View) for all other modules
  return (
    <div className="h-full flex flex-col bg-gray-50 flex-1 overflow-hidden">
      <div className="p-6 pb-4 flex items-center justify-between flex-shrink-0">
        <div className="relative w-[300px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search logs..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633]/20 focus:border-[#FF6633] transition-all"
          />
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          <span>New Entry</span>
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-[180px_1fr_150px_60px] gap-4 items-center px-6 py-3 border-b border-gray-100 bg-white shadow-sm sticky top-0 z-10">
            <div className="flex items-center gap-1 text-[12px] font-bold text-gray-400 uppercase tracking-wider">
              Recorded By
              <ArrowUpDown className="w-3 h-3" />
            </div>
            <div className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Findings / Summary</div>
            <div className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Time</div>
            <div></div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-gray-300" />
              <p className="text-sm font-medium">Fetching secure records...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Icon className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {title === "Insights" ? "No insights" : `No ${title.toLowerCase()} found`}
              </h3>
              <p className="text-gray-500 text-sm max-w-[280px] mx-auto">
                {emptyMessage || (title === "Insights" ? "There are no automated insights gathered for this project period yet." : `There are no ${title.toLowerCase()} recorded for this project on ${format(selectedDate, "MMM d, yyyy")}.`)}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.map((item: any, idx: number) => {
                 const note = item.metrics?.find((m: any) => {
                    const l = (m.label || m.name || '').toLowerCase();
                    return l.includes('note') || l.includes('desc') || l.includes('summary');
                 })?.value || item.action || 'Daily inspection record';

                 return (
                  <div key={item.id || idx} className="grid grid-cols-[180px_1fr_150px_60px] gap-4 items-center px-6 py-4 hover:bg-gray-50/50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">
                        {item.employeeName?.charAt(0)}
                      </div>
                      <span className="text-[14px] text-gray-900 font-bold truncate">
                        {item.employeeName}
                      </span>
                    </div>
                    
                    <div className="text-[14px] text-gray-600 truncate pr-4">
                      {note}
                    </div>

                    <div className="flex items-center gap-2 text-[13px] text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      {item.timestamp?.includes(' at ') ? item.timestamp.split(' at ')[1] : 'Manual'}
                    </div>

                    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                 );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
