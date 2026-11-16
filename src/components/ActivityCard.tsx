"use client";

import { ChevronDown, FileText } from "lucide-react";
import { useState, useMemo } from "react";
import type { Activity } from "./ActivityScreen";
import { ImageViewer } from "./ImageViewer";
import { normalizeRemotePhotoUrl, isDisplayableImageUrl, isBrowserResolvableUrl } from "@/lib/photo-url";
import { clearActivityFeedSnapshot } from "@/lib/activity-feed-client-cache";
import { formatLoggedAtReportLine } from "@/lib/activity-display-timezone";
import { reportDateColumnToYmd } from "@/lib/report-date-filter";

interface ActivityCardProps {
  activity: Activity;
}

/** Matches API copy `submitted a {category} note in` for Notes (category from DB). */
function noteCategoryFromAction(action: string): string | null {
  const m = action.match(/^submitted a (.+?) note in$/i);
  const cat = m?.[1]?.trim();
  return cat || null;
}

function ActionInProjectPhrase({
  activity,
  noteCategory,
}: {
  activity: Activity;
  noteCategory: string | null;
}) {
  if (activity.activityType === 'Reports') {
    return <> signed daily report in </>;
  }
  const cat = activity.activityType === 'Notes' ? noteCategory : null;
  if (cat) {
    return (
      <>
        {' '}
        submitted a <span className="font-bold uppercase tracking-wide text-gray-900">{cat}</span> note in{' '}
      </>
    );
  }
  const action = activity.action.trim();
  const phrase = action.endsWith(' in') ? action : `${action} in`;
  return <> {phrase} </>;
}

export function ActivityCard({ activity }: ActivityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewerState, setViewerState] = useState<{ isOpen: boolean; index: number }>({
    isOpen: false,
    index: 0
  });

  const noteContent = activity.metrics?.find((m: any) => {
    const l = (m.label || m.name || '').toLowerCase();
    return (
      l === 'description' || l === 'note' || l === 'content' || 
      l === 'details' || l === 'comment' || l === 'message' || 
      l === 'general note' || l === 'text' ||
      l.includes('note') || l.includes('desc')
    );
  })?.value;

  const otherMetrics = activity.metrics.filter(m => 
    !m.highlight && 
    !m.label.toLowerCase().includes('note') && 
    !m.label.toLowerCase().includes('desc')
  );

  /** Skip duplicate "NOTE | …" blue row when the same text is already in the quote box above. */
  const highlightedMetrics = useMemo(() => {
    const noteTrim =
      noteContent != null && String(noteContent).trim() !== '' ? String(noteContent).trim() : '';
    return activity.metrics.filter((m) => {
      if (!m.highlight) return false;
      if (noteTrim && String(m.value ?? '').trim() === noteTrim) return false;
      return true;
    });
  }, [activity.metrics, noteContent]);

  const allUrls = useMemo(
    () => activity.photos.map((p) => normalizeRemotePhotoUrl(p)).filter(Boolean),
    [activity.photos]
  );
  /** Drop bare filenames / file URLs so the dashboard does not request `/UUID.jpg` (404). */
  const remoteUrls = useMemo(() => allUrls.filter(isBrowserResolvableUrl), [allUrls]);
  const imageUrls = useMemo(() => remoteUrls.filter(isDisplayableImageUrl), [remoteUrls]);
  const fileUrls = useMemo(() => remoteUrls.filter((u) => !isDisplayableImageUrl(u)), [remoteUrls]);

  const noteCategory = useMemo(
    () => (activity.activityType === 'Notes' ? noteCategoryFromAction(activity.action) : null),
    [activity.activityType, activity.action]
  );

  const isMetricsActivity = activity.activityType === 'Metrics';

  const displayTimestamp = useMemo(() => {
    if (!activity.isoTimestamp) return activity.timestamp;
    const reportRaw = activity.reportDateYmd ?? activity.selectedDateYmd ?? null;
    return formatLoggedAtReportLine(
      activity.isoTimestamp,
      reportRaw,
      reportDateColumnToYmd
    );
  }, [activity.reportDateYmd, activity.selectedDateYmd, activity.isoTimestamp, activity.timestamp]);

  /** Compact one-line summary for daily metrics (skip empty / dash / NOTES). */
  const metricsOneLiner = useMemo(() => {
    if (!isMetricsActivity) return '';
    return activity.metrics
      .filter((m) => {
        const label = String(m.label || '').toLowerCase();
        if (label.includes('note')) return false;
        const v = String(m.value ?? '').trim();
        return v !== '' && v !== '—';
      })
      .map((m) => {
        const unit = m.unit ? ` ${m.unit}` : '';
        return `${m.label} ${m.value}${unit}`;
      })
      .join(' · ');
  }, [activity.metrics, isMetricsActivity]);

  const hasExpandableContent =
    imageUrls.length > 0 ||
    fileUrls.length > 0 ||
    otherMetrics.length > 0 ||
    (!isMetricsActivity && activity.metrics.length > 0);

  const photoThumb = (src: string, index: number, size: 'row' | 'grid') => (
    <button
      key={`${src}-${index}`}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setViewerState({ isOpen: true, index });
      }}
      className={
        size === 'row'
          ? 'w-[4.25rem] h-[4.25rem] sm:w-[4.75rem] sm:h-[4.75rem] flex-shrink-0 relative group overflow-hidden rounded-lg border border-gray-100 hover:border-[#FF6633] transition-all focus:outline-none shadow-sm bg-gray-50'
          : 'w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 flex-shrink-0 relative group overflow-hidden rounded-xl border border-gray-100 hover:border-[#FF6633] transition-all focus:outline-none shadow-sm hover:shadow-md bg-gray-50'
      }
      aria-label={`View photo ${index + 1}`}
    >
      <img
        src={src}
        alt={`Activity photo ${index + 1}`}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
    </button>
  );

  return (
    <div 
      className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all duration-200"
      role="article"
      aria-label={`Activity by ${activity.employeeName}`}
    >
      {/* Main Card Content */}
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="flex-1 min-w-0 flex flex-col pt-0.5">
              {/* Header Info */}
              <p className="text-[15px] text-gray-800 leading-snug">
                <span className="font-semibold text-gray-900">{activity.employeeName}</span>
                <ActionInProjectPhrase activity={activity} noteCategory={noteCategory} />
                <span className="text-gray-800">{activity.project}</span>
              </p>

              <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                <span>{displayTimestamp}</span>
              </div>

              {isMetricsActivity && metricsOneLiner ? (
                <p className="mt-3 text-[14px] text-gray-700 truncate" title={metricsOneLiner}>
                  {metricsOneLiner}
                </p>
              ) : null}

              {/* Note/Description - Always Visible */}
              {!isMetricsActivity && noteContent && (
                <div className="mt-4 p-3.5 bg-blue-50/50 border border-blue-100/50 rounded-xl">
                  <p className="text-[14px] text-gray-700 italic leading-relaxed">
                    "{noteContent}"
                  </p>
                </div>
              )}

              {/* Collapsed: single horizontal row of photos */}
              {imageUrls.length > 0 && !isExpanded && (
                <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 -mx-0.5 [scrollbar-width:thin]">
                  {imageUrls.map((src, index) => photoThumb(src, index, 'row'))}
                </div>
              )}

              {/* Highlighted Metrics (not for Metrics type — those use one-liner above) */}
              {!isMetricsActivity &&
                highlightedMetrics.map((metric, index) => (
                <div key={index} className="mt-5 flex items-baseline gap-1.5 pb-1">
                  <span className="text-[15px] text-gray-700 uppercase tracking-tight font-medium">{metric.label} |</span>
                  <span className="text-[15px] font-bold text-[#2196F3]">{metric.value}</span>
                  {metric.unit && <span className="text-[13px] text-gray-500">{metric.unit}</span>}
                </div>
              ))}
            </div>
          </div>

          {hasExpandableContent && (
            <div className="flex items-start flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Collapse activity' : 'Expand activity'}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200"
              >
                <ChevronDown
                  className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="mt-5 pt-5 border-t border-gray-100 space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
            {imageUrls.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Photos ({imageUrls.length})
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {imageUrls.map((src, index) => photoThumb(src, index, 'grid'))}
                </div>
              </div>
            )}
            {fileUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {fileUrls.map((href) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-[#1565C0] hover:bg-gray-50"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    Open file
                  </a>
                ))}
              </div>
            )}
            {!isMetricsActivity && otherMetrics.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                {otherMetrics.map((metric, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center py-0.5 border-b border-gray-50 last:border-0 pb-1"
                  >
                    <span className="text-sm text-gray-500">{metric.label}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold text-gray-900">{metric.value}</span>
                      {metric.unit && <span className="text-xs text-gray-400">{metric.unit}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isMetricsActivity && activity.metrics.length > 0 && (
              <div className="space-y-3">
                {activity.metrics.map((metric, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0"
                  >
                    <span className="text-[15px] text-gray-600">{metric.label}</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[15px] font-bold text-gray-900">{metric.value}</span>
                      {metric.unit && <span className="text-xs text-gray-500">{metric.unit}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activity.activityType === 'Checklists' && activity.metrics.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activity.metrics.map((metric, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-4 ${
                      metric.highlight
                        ? 'border-[#2196F3]/30 bg-blue-50/40'
                        : 'border-gray-100 bg-gray-50/50'
                    }`}
                  >
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                      {metric.label}
                    </p>
                    <p
                      className={`text-[15px] font-bold mt-1 ${
                        metric.highlight ? 'text-[#2196F3]' : 'text-gray-900'
                      }`}
                    >
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rich Image Viewer */}
      <ImageViewer 
        isOpen={viewerState.isOpen}
        photos={imageUrls}
        initialIndex={viewerState.index}
        onClose={() => setViewerState({ ...viewerState, isOpen: false })}
        metadata={{
          fileName: imageUrls[viewerState.index]?.split('/').pop(),
          uploadedBy: activity.employeeName,
          date: activity.timestamp,
          description: noteContent,
          project: activity.project,
          sourceId: activity.id,
          sourceType: activity.activityType,
        }}
        onPhotoDeleted={() => {
          clearActivityFeedSnapshot();
        }}
      />
    </div>
  );
}
