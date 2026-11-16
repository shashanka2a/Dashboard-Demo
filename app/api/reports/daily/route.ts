import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { formatProjectAddress, resolveProjectRow } from '@/lib/resolve-project';
import { isUuidLike } from '@/lib/is-uuid';
import { fetchDayWeatherForReport } from '@/lib/weather-report';
import { getCompanyBrandLogoForReport } from '@/lib/company-brand';
import { equipmentChecklistFormDisplayFields, normalizeEquipmentChecklistRow } from '@/lib/equipment-checklist';
import { hasCloudinaryUploadedUrls, normalizeRemotePhotoUrl, photoUrlForDailyReportEmbed } from '@/lib/photo-url';
import {
  filterRowsByReportDay,
  resolveRowReportDateYmd,
  rowReportDateInRange,
  supabaseReportDayOrFilterWide,
  utcDayBoundsIso,
} from '@/lib/report-date-filter';
import { aggregateMetricField, latestMetricsPerProjectDay, type MetricFieldDef, type MetricRowLike } from '@/lib/metric-values';
import { resolveObservationDescription } from '@/lib/observation-fields';

function safeRows<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) {
    console.warn('[daily-report]', res.error.message);
    return [] as T;
  }
  return (res.data ?? []) as T;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function looksLikeEmail(s: string): boolean {
  const t = s.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(t);
}

/** Prefer directory `employees.name` when `prepared_by` stores an email. */
async function displayNameForPreparedBy(raw: string): Promise<string> {
  const t = String(raw || '').trim();
  if (!t) return t;
  if (!looksLikeEmail(t)) return t;
  const lower = t.toLowerCase();
  const { data, error } = await supabaseServer.from('employees').select('name').ilike('email', lower).maybeSingle();
  if (error) return t;
  const n = String((data as { name?: string } | null)?.name ?? '').trim();
  return n || t;
}

/** Best-effort filename for Save / download attribute (URL path or fallback). */
function guessPhotoFilename(url: string, index: number): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean).pop() || '';
    const clean = seg.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (/\.(jpe?g|png|gif|webp|bmp)$/i.test(clean)) return clean;
  } catch {
    /* ignore */
  }
  return `photo-${String(index + 1).padStart(2, '0')}.jpg`;
}

type ReportPhotoEntry = { url: string; ts: string; caption: string };

function parseUrlList(urls: unknown): string[] {
  if (Array.isArray(urls)) return urls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  if (typeof urls === 'string') {
    try {
      const parsed = JSON.parse(urls || '[]') as unknown;
      return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const REPORT_PHOTO_DOWNLOAD_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

function buildReportPhotoDownloadIconHtml(url: string, filename: string): string {
  return `<a class="report-photo-download report-photo-download-icon" href="${escapeHtml(url)}" data-filename="${escapeHtml(filename)}" title="Download" aria-label="Download photo">${REPORT_PHOTO_DOWNLOAD_ICON_SVG}</a>`;
}

function reportPhotoImgSrc(fullUrl: string, forPdfEmbed: boolean): string {
  const normalized = normalizeRemotePhotoUrl(fullUrl);
  return forPdfEmbed ? photoUrlForDailyReportEmbed(normalized) : normalized;
}

function buildNotePhotoHtml(
  fullUrl: string,
  noteIndex: number,
  photoIndex: number,
  forPdfEmbed: boolean
): string {
  const fn = guessPhotoFilename(fullUrl, noteIndex * 10 + photoIndex);
  const imgSrc = reportPhotoImgSrc(fullUrl, forPdfEmbed);
  return `<div class="note-photo-card">
    <div class="report-photo-media">
      <a class="note-photo-open" href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" title="Open full size">
        <img src="${escapeHtml(imgSrc)}" alt="" ${forPdfEmbed ? 'loading="eager" decoding="sync"' : 'loading="lazy" decoding="async"'} />
      </a>
      ${buildReportPhotoDownloadIconHtml(fullUrl, fn)}
    </div>
  </div>`;
}

function buildSitePhotoHtml(p: ReportPhotoEntry, index: number, forPdfEmbed: boolean): string {
  const fn = guessPhotoFilename(p.url, index);
  const imgSrc = reportPhotoImgSrc(p.url, forPdfEmbed);
  return `<div class="photo-thumb">
    <div class="report-photo-media report-photo-media-square">
      <a class="report-photo-open" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer" title="Open full size">
        <img src="${escapeHtml(imgSrc)}" alt="" ${forPdfEmbed ? 'loading="eager" decoding="sync"' : 'loading="lazy" decoding="async"'} />
      </a>
      ${buildReportPhotoDownloadIconHtml(p.url, fn)}
    </div>
  </div>`;
}

/** Enables Save via fetch+blob when CORS allows; otherwise opens image in a new tab. */
const REPORT_PHOTO_DOWNLOAD_SCRIPT = `<script>
(function(){
  function nameFrom(a){ return a.getAttribute('data-filename') || 'photo.jpg'; }
  document.body.addEventListener('click', function(e){
    var a = e.target.closest('a.report-photo-download');
    if (!a || !a.href) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    var url = a.getAttribute('href');
    var fname = nameFrom(a);
    fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('bad'); return r.blob(); })
      .then(function(blob){
        var u = URL.createObjectURL(blob);
        var x = document.createElement('a');
        x.href = u; x.download = fname;
        document.body.appendChild(x); x.click(); x.remove();
        setTimeout(function(){ URL.revokeObjectURL(u); }, 2500);
      })
      .catch(function(){ window.open(url, '_blank', 'noopener,noreferrer'); });
  });
})();
</script>`;

function utcDayBounds(dateParam: string): { start: string; end: string } {
  return {
    start: `${dateParam}T00:00:00.000Z`,
    end: `${dateParam}T23:59:59.999Z`,
  };
}

/** Monday 00:00 UTC of the week containing dateParam through end of selected day */
function utcWeekStartIso(dateParam: string): string {
  const [y, m, d] = dateParam.split('-').map(Number);
  const noon = Date.UTC(y, m - 1, d, 12, 0, 0);
  const dow = new Date(noon).getUTCDay();
  const mondayOffset = (dow + 6) % 7;
  const monMs = noon - mondayOffset * 86400000;
  const mon = new Date(monMs);
  return `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, '0')}-${String(mon.getUTCDate()).padStart(2, '0')}T00:00:00.000Z`;
}

type MetricRow = MetricRowLike & {
  notes?: string | null;
  logged_at?: string | null;
  signature_url?: string | null;
};

const FALLBACK_METRIC_FIELDS: MetricFieldDef[] = [
  { key: 'acres_completed', label: 'Acres', unit: 'Acres' },
  { key: 'green_space_completed', label: 'Green space', unit: 'sq ft' },
  { key: 'water_usage', label: 'Water usage', unit: 'gal' },
  { key: 'number_of_operators', label: 'Operators', unit: '' },
];

function aggregateMetricsByFields(rows: MetricRow[], fields: MetricFieldDef[]) {
  const out: Record<string, number> = {};
  for (const f of fields) {
    out[f.key] = aggregateMetricField(rows, f.key, f.key === 'number_of_operators' ? 'max' : 'sum');
  }
  return out;
}

function fmtNum(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

type ChemLine = { name: string; quantity: number; unit: string };

function flattenChemicals(
  logs: { chemicals?: { name: string; quantity: number; unit: string }[] }[]
): ChemLine[] {
  const out: ChemLine[] = [];
  for (const log of logs) {
    const items = Array.isArray(log.chemicals) ? log.chemicals : [];
    for (const c of items) {
      if (!c?.name) continue;
      out.push({
        name: c.name,
        quantity: Number(c.quantity) || 0,
        unit: c.unit || '',
      });
    }
  }
  return out;
}

function aggregateChems(lines: ChemLine[]): Map<string, { quantity: number; unit: string }> {
  const map = new Map<string, { quantity: number; unit: string }>();
  for (const line of lines) {
    const key = `${line.name}||${line.unit}`;
    const prev = map.get(key);
    if (prev) prev.quantity += line.quantity;
    else map.set(key, { quantity: line.quantity, unit: line.unit });
  }
  return map;
}

function priClass(p: string | null | undefined): string {
  const x = (p || '').toLowerCase();
  if (x.includes('critical')) return 'pri-critical';
  if (x.includes('high')) return 'pri-high';
  if (x.includes('medium')) return 'pri-medium';
  return 'pri-low';
}

/** Inventory table from `inventory` (dashboard-managed; avoids duplicating metrics/chemicals narrative). */
function buildInventoryHtml(rows: { name: string; quantity: number | null }[]): string {
  if (rows.length === 0) return '';

  const tbody = rows
    .map((r) => {
      const q =
        r.quantity != null && Number.isFinite(Number(r.quantity))
          ? Number(r.quantity).toLocaleString('en-US', { maximumFractionDigits: 4 })
          : '—';
      return `<tr><td>${escapeHtml(r.name)}</td><td class="td-num"><span class="val">${escapeHtml(q)}</span></td></tr>`;
    })
    .join('');

  return `<div class="section-wrap">
    <div class="section-header">Inventory</div>
    <div class="table-wrap">
      <table class="inventory-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  </div>`;
}

function collectDaySignatureRefs(
  metricsDay: MetricRow[],
  chemDayLogs: unknown[],
  checklists: unknown[]
): { url: string; label: string }[] {
  const out: { url: string; label: string }[] = [];
  for (const m of metricsDay) {
    const u = m.signature_url;
    if (typeof u === 'string' && u.length > 0) {
      const t = m.logged_at ? new Date(m.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      out.push({ url: u, label: t ? `Metrics · ${t}` : 'Metrics' });
    }
  }
  for (const log of chemDayLogs) {
    const row = log as { signature_url?: string | null; logged_at?: string };
    const u = row.signature_url;
    if (typeof u === 'string' && u.length > 0) {
      const t = row.logged_at ? new Date(row.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      out.push({ url: u, label: t ? `Chemicals · ${t}` : 'Chemicals' });
    }
  }
  for (const chk of checklists) {
    const c = chk as { signature_url?: string | null; logged_at?: string };
    const u = c.signature_url;
    if (typeof u === 'string' && u.length > 0) {
      const t = c.logged_at ? new Date(c.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      out.push({ url: u, label: t ? `Equipment · ${t}` : 'Equipment checklist' });
    }
  }
  return out;
}

const REPORT_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #555; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .report-sheet { width: 100%; max-width: 850px; margin: 40px auto 60px; background: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.35); position: relative; padding-bottom: 56px; }
  .section-header { background: #FF6633; color: #fff; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 16px; }
  .section-wrap { padding: 0 28px; margin-top: 20px; }
  .top-bar { background: #000; color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 10px 28px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; flex-wrap: wrap; gap: 8px; }
  .report-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 24px 28px; border-bottom: 1px solid #e0e0e0; }
  .report-header h1 { font-size: 22px; font-weight: 700; color: #222; margin-bottom: 4px; }
  .report-header p { font-size: 13px; color: #666; }
  .report-brand-logo-wrap { flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end; max-width: min(100%, 340px); margin-left: 12px; }
  .report-brand-logo { max-height: 52px; max-width: 100%; width: auto; height: auto; object-fit: contain; display: block; }
  .weather-grid { display: flex; border: 1px solid #ddd; }
  .weather-cell { flex: 1; text-align: center; padding: 16px 8px; border-right: 1px solid #ddd; }
  .weather-cell:last-child { border-right: none; }
  .weather-cell .time { font-size: 16px; font-weight: 700; color: #222; margin-bottom: 8px; }
  .weather-cell .temp { font-size: 28px; font-weight: 700; color: #222; margin: 8px 0; }
  .weather-cell .cond { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
  .weather-cell .info { font-size: 10px; color: #666; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 10px 12px; }
  thead tr { background: #f5f5f5; }
  th { text-align: center; color: #444; font-weight: 700; border-bottom: 1px solid #ddd; }
  th:first-child { text-align: left; }
  td { border-bottom: 1px solid #eee; }
  td:first-child { font-weight: 500; color: #444; }
  .td-num { text-align: center; }
  .td-num .val { font-weight: 700; font-size: 14px; color: #222; }
  .td-num .unit { font-size: 10px; color: #888; margin-top: 2px; }
  .td-to-date { background: #fafafa; }
  .th-to-date { background: #f0f0f0 !important; }
  .table-wrap { border: 1px solid #ddd; border-top: none; }
  .notes-body { padding: 16px 28px; }
  .note-block { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #eee; }
  .note-block:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .note-item { margin-bottom: 8px; font-size: 13px; color: #222; line-height: 1.6; }
  .note-meta { font-size: 11px; color: #888; font-weight: 600; margin-top: 8px; }
  .note-photo-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 10px 0 4px; }
  .note-photo-card { display: flex; flex-direction: column; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; background: #fafafa; }
  .report-photo-media { position: relative; }
  .report-photo-media-square .report-photo-open { aspect-ratio: 1; }
  .note-photo-open { display: block; aspect-ratio: 4/3; overflow: hidden; cursor: pointer; line-height: 0; }
  .note-photo-open img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .report-photo-download-icon {
    position: absolute; top: 6px; right: 6px; z-index: 2;
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 4px;
    background: rgba(255,255,255,0.94); color: #1565C0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.18); text-decoration: none; padding: 0;
  }
  .report-photo-download-icon:hover { background: #fff; color: #0d47a1; }
  .report-photo-download-icon svg { display: block; pointer-events: none; }
  .card-body { border: 1px solid #ddd; border-top: none; padding: 16px; }
  .card-item + .card-item { border-top: 1px solid #eee; padding-top: 16px; margin-top: 16px; }
  .card-title { font-size: 13px; font-weight: 700; color: #222; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; padding: 2px 6px; border-radius: 3px; margin-left: 6px; }
  .badge-open { background: #FFF3E0; color: #E65100; }
  .badge-closed { background: #E8F5E9; color: #2E7D32; }
  .badge-rec { background: #FFEBEE; color: #C62828; }
  .badge-neg { background: #F44336; color: #fff; }
  .badge-pos { background: #4CAF50; color: #fff; }
  .badge-orange { background: #FF6633; color: #fff; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 12px; margin-top: 8px; }
  .span-2 { grid-column: 1 / -1; }
  .detail { font-size: 12px; margin-top: 6px; }
  .pri-low { color: #4CAF50; font-weight: 700; }
  .pri-medium { color: #FF9800; font-weight: 700; }
  .pri-high { color: #FF6633; font-weight: 700; }
  .pri-critical { color: #F44336; font-weight: 700; }
  .checklist-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f9f9f9; border: 1px solid #eee; border-radius: 4px; padding: 10px; font-size: 13px; }
  .sig-img { max-width: 200px; height: 40px; object-fit: contain; border-bottom: 2px solid #000; margin-top: 8px; }
  .photo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .photo-batch { margin-bottom: 16px; }
  .photo-batch:last-child { margin-bottom: 0; }
  .photo-thumb { display: flex; flex-direction: column; background: #eee; border-radius: 4px; overflow: hidden; border: 1px solid #ddd; }
  .report-photo-open { display: block; aspect-ratio: 1; width: 100%; overflow: hidden; cursor: pointer; line-height: 0; }
  .report-photo-open:hover img { opacity: 0.92; }
  .report-photo-open img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photo-caption { padding: 8px 10px; font-size: 12px; color: #333; line-height: 1.45; background: #fff; border-top: 1px solid #eee; min-height: 2.8em; }
  .photo-thumb-bar { display: flex; align-items: center; justify-content: flex-end; gap: 6px; padding: 5px 7px; background: #fafafa; border-top: 1px solid #eee; font-size: 10px; }
  .photo-ts { font-weight: 700; font-family: ui-monospace, monospace; color: #555; text-align: right; min-width: 0; }
  .survey-body { padding: 16px 28px; }
  .survey-table th { width: auto; }
  .survey-table th.col-chk { width: 40px; }
  .chkbox { display: inline-flex; width: 14px; height: 14px; border: 1px solid #999; background: #eee; align-items: center; justify-content: center; font-size: 11px; }
  .survey-table td { vertical-align: top; }
  .survey-table td.italic { color: #555; font-style: italic; }
  .app-type-row { padding: 8px 16px; border-bottom: 1px solid #eee; font-size: 11px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .app-type-label { font-weight: 700; text-transform: uppercase; color: #666; }
  .inventory-table th:last-child, .inventory-table td:last-child { text-align: center; width: 160px; }
  .signature-gallery { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 16px; align-items: flex-end; }
  .signature-gallery .sig-unit { max-width: 220px; }
  .signature-gallery .sig-unit .sig-meta { font-size: 11px; color: #888; font-weight: 600; margin-top: 6px; }
  .signature-block { padding: 20px 28px; border-top: 1px solid #eee; margin-top: 20px; }
  .daily-signed-signature-wrap { margin-bottom: 4px; }
  .daily-signed-signature-img { display: block; max-width: 320px; max-height: 120px; width: auto; height: auto; object-fit: contain; border-bottom: 2px solid #000; }
  .daily-signed-signature-caption { font-size: 11px; color: #888; font-weight: 600; margin-top: 8px; margin-bottom: 16px; }
  .signature-block p { font-size: 13px; font-weight: 700; margin-bottom: 16px; margin-top: 0; }
  .signature-block .signature-gallery img { max-width: 280px; height: 56px; object-fit: contain; border-bottom: 2px solid #000; }
  .signature-block .sig-meta { font-size: 11px; color: #888; font-weight: 600; margin-top: 8px; }
  .report-footer { text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; padding: 16px 28px 20px; margin-top: 40px; }
  .report-footer span { font-weight: 900; letter-spacing: 0.1em; color: #FF6633; }
  @media print {
    @page { size: A4; margin: 8mm; }
    body { background: #fff; }
    .report-sheet { margin: 0 !important; padding-bottom: 16px !important; box-shadow: none; max-width: none; width: 100%; }
    .report-photo-download-icon { display: none !important; }
    .section-header { break-after: avoid; page-break-after: avoid; }
    /* Weather is small — keep on one page. Tables may span pages (avoid on .table-wrap caused huge gaps). */
    .weather-grid { break-inside: avoid; page-break-inside: avoid; }
    .table-wrap { break-inside: auto; page-break-inside: auto; }
    table thead { display: table-header-group; }
    table tbody tr { break-inside: avoid; page-break-inside: avoid; }
    .section-wrap, .note-block, .card-body { break-inside: auto; page-break-inside: auto; }
    .note-photo-list { break-inside: auto; page-break-inside: auto; }
    .note-photo-card, .photo-thumb { break-inside: avoid; page-break-inside: avoid; }
    a.note-photo-open, a.report-photo-open { color: inherit; text-decoration: none; }
  }
`;

const REPORT_PDF_EXPORT_CSS = `
  @page { size: A4; margin: 8mm; }
  body { background: #fff !important; margin: 0 !important; }
  .report-sheet { margin: 0 !important; padding-bottom: 16px !important; box-shadow: none !important; max-width: 100% !important; }
  .report-photo-download-icon { display: none !important; }
  /*
   * Chromium print: avoid break-after on section titles (pulls whole next block to new page),
   * avoid break-inside on tables/photo cards (same), and overflow:hidden on cards blocks fragmentation.
   */
  .report-sheet-pdf .section-header { break-after: auto !important; page-break-after: auto !important; }
  .report-sheet-pdf .section-wrap,
  .report-sheet-pdf .note-block,
  .report-sheet-pdf .card-body,
  .report-sheet-pdf .note-photo-list,
  .report-sheet-pdf .table-wrap,
  .report-sheet-pdf table,
  .report-sheet-pdf tbody,
  .report-sheet-pdf tr,
  .report-sheet-pdf td { break-inside: auto !important; page-break-inside: auto !important; }
  .report-sheet-pdf table thead { display: table-header-group; }
  .report-sheet-pdf .weather-grid { break-inside: avoid; page-break-inside: avoid; }
  .report-sheet-pdf .note-photo-card,
  .report-sheet-pdf .photo-thumb { overflow: visible !important; break-inside: auto !important; page-break-inside: auto !important; }
  .report-sheet-pdf .note-photo-open,
  .report-sheet-pdf .report-photo-open { aspect-ratio: unset !important; height: auto !important; max-height: none !important; }
  .report-sheet-pdf .note-photo-open img,
  .report-sheet-pdf .report-photo-open img { width: 100% !important; height: auto !important; max-height: 200px !important; object-fit: contain !important; }
  .report-sheet-pdf .photo-caption { min-height: 0 !important; }
`;

function buildWeatherSectionHtml(
  _dateYmd: string,
  weather: Awaited<ReturnType<typeof fetchDayWeatherForReport>>,
  projectRow: { zip_code?: string | null; city?: string | null; state?: string | null }
): string {
  const hasLoc = Boolean(projectRow.zip_code?.trim() || [projectRow.city, projectRow.state].filter(Boolean).length);

  if (weather) {
    const detailBits: string[] = [`Hi ${weather.highF}°F / Lo ${weather.lowF}°F`];
    if (weather.precipInches != null) detailBits.push(`Precip ${weather.precipInches.toFixed(2)} in`);
    if (weather.windMph != null) detailBits.push(`Wind max ${weather.windMph} mph`);
    const summaryLine = detailBits.join(' · ');

    const cells =
      weather.snapshots.length > 0
        ? weather.snapshots
            .map((s) => {
              const bits: string[] = [escapeHtml(s.conditionLabel)];
              if (s.windMph != null) bits.push(`Wind ${s.windMph} mph`);
              if (s.humidityPct != null) bits.push(`Humidity ${s.humidityPct}%`);
              return `<div class="weather-cell">
        <div class="time">${escapeHtml(s.timeLabel)}</div>
        <div class="temp">${s.tempF}°F</div>
        <div class="info">${bits.join(' · ')}</div>
      </div>`;
            })
            .join('')
        : `<div class="weather-cell">
        <div class="time">High</div>
        <div class="temp">${weather.highF}°F</div>
        <div class="info">Daytime high</div>
      </div>
      <div class="weather-cell">
        <div class="time">Low</div>
        <div class="temp">${weather.lowF}°F</div>
        <div class="info">Daily low</div>
      </div>
      <div class="weather-cell">
        <div class="time">Sky</div>
        <div class="temp" style="font-size:20px;line-height:1.2;">${escapeHtml(weather.conditionLabel)}</div>
        <div class="cond">Conditions</div>
        <div class="info">${escapeHtml(summaryLine)}</div>
      </div>`;

    return `<div class="section-wrap">
    <div class="section-header">Weather</div>
    <div class="weather-grid">${cells}</div>
    ${weather.snapshots.length > 0 ? `<div class="notes-body" style="padding:10px 20px;color:#666;font-size:11px;border-top:1px solid #eee;">${escapeHtml(summaryLine)}</div>` : ''}
  </div>`;
  }

  const hint = hasLoc
    ? 'Weather could not be loaded for this date or location (Open-Meteo).'
    : 'Add a zip code or city/state on the project to show weather.';
  return `<div class="section-wrap">
    <div class="section-header">Weather</div>
    <div class="notes-body" style="padding:14px 20px;color:#555;font-size:13px;">
      ${escapeHtml(hint)}
    </div>
  </div>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  let projectParam = searchParams.get('project');
  let projectIdParam = searchParams.get('project_id');
  if (!projectIdParam && projectParam && isUuidLike(projectParam)) {
    projectIdParam = projectParam.trim();
    projectParam = null;
  }

  if (!dateParam || ((!projectParam || projectParam === 'All Projects') && !projectIdParam)) {
    return new NextResponse('Please select a specific project and date to generate a daily report.', { status: 400 });
  }

  const { row: projectRow, error: resolveErr } = await resolveProjectRow(supabaseServer, {
    projectId: projectIdParam,
    projectName: projectParam?.trim() || null,
  });

  if (resolveErr) {
    console.warn('[daily-report]', resolveErr);
    return new NextResponse(
      `<div style="padding:40px;font-family:sans-serif"><h2>Cannot resolve project</h2><p>${escapeHtml(resolveErr)}</p></div>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  if (!projectRow?.id) {
    const label = projectParam || projectIdParam || 'Unknown';
    const hint =
      projectIdParam && !projectParam
        ? 'No project with this id exists in the database.'
        : 'No project matched this name in the database.';
    return new NextResponse(
      `<div style="padding:40px;font-family:sans-serif"><h2>Project not found</h2><p>${hint}</p><p><b>${escapeHtml(String(label))}</b></p></div>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const pdfExport = searchParams.get('pdf') === '1';

  const projectId = projectRow.id;
  const projectName = projectRow.name || projectParam || 'Project';
  const projectDisplayLocation = formatProjectAddress(projectRow);
  const jobLabel = projectRow.job_number ? `Job # ${escapeHtml(String(projectRow.job_number))}` : 'Job # —';

  const { start: startDate, end: endDate } = utcDayBoundsIso(dateParam);
  const weekStart = utcWeekStartIso(dateParam);
  const weekStartYmd = weekStart.slice(0, 10);
  const dateYmd = String(dateParam).trim().slice(0, 10);
  const dayFilter = supabaseReportDayOrFilterWide(dateYmd);
  /** Metrics/chemicals need full project history through the report day for week + to-date columns. */
  const historyThroughDayFilter = `report_date.lte.${dateYmd},and(report_date.is.null,logged_at.lte.${endDate})`;
  const signedRowDayFilter = `report_date.eq.${dateYmd},and(report_date.is.null,signed_at.gte.${startDate},signed_at.lte.${endDate})`;
  const signedRowDayFilterFb = `report_date.eq.${dateYmd},and(report_date.is.null,created_at.gte.${startDate},created_at.lte.${endDate})`;

  const [
    notesRes,
    metricsAllRes,
    chemAllRes,
    incidentsRes,
    obsRes,
    surveysRes,
    checklistsRes,
    attachRes,
    inventoryRes,
    signedDayRes,
    dayWeather,
  ] = await Promise.all([
    supabaseServer.from('notes').select('*').eq('project_id', projectId).or(dayFilter),
    supabaseServer.from('metrics').select('*').eq('project_id', projectId).or(historyThroughDayFilter),
    supabaseServer
      .from('chemicals_logs')
      .select('*, chemicals:chemical_applications(name, quantity, unit)')
      .eq('project_id', projectId)
      .or(historyThroughDayFilter),
    supabaseServer.from('incidents').select('*').eq('project_id', projectId).or(dayFilter),
    supabaseServer
      .from('observations')
      .select('*')
      .eq('project_id', projectId)
      .or(dayFilter),
    supabaseServer
      .from('surveys')
      .select('*, questions:survey_questions(question, answer, description)')
      .eq('project_id', projectId)
      .or(dayFilter),
    supabaseServer.from('equipment_checklists').select('*').eq('project_id', projectId).or(dayFilter),
    supabaseServer.from('attachments').select('*').eq('project_id', projectId).or(dayFilter),
    supabaseServer.from('inventory').select('name, quantity').eq('project_id', projectId).order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabaseServer
      .from('daily_signed_reports')
      .select('prepared_by, signed_at, signature_url, created_at, id, report_date')
      .eq('project_id', projectId)
      .or(signedRowDayFilter)
      .order('signed_at', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1),
    fetchDayWeatherForReport(projectRow, dateParam),
  ]);

  const notes = filterRowsByReportDay(safeRows(notesRes) as Record<string, unknown>[], dateYmd);
  // One metrics row per calendar day (latest submit), then roll up day / week / to-date.
  const metricsAll = latestMetricsPerProjectDay(safeRows(metricsAllRes) as MetricRow[]).filter((r) => {
    const row = r as Record<string, unknown>;
    const rd = resolveRowReportDateYmd(row);
    if (rd) return rd <= dateYmd;
    const la = row.logged_at;
    if (!la) return false;
    return String(la).slice(0, 10) <= dateYmd;
  });
  const metricsDay = metricsAll.filter((r) =>
    rowReportDateInRange(r as Record<string, unknown>, dateYmd, dateYmd)
  );
  const metricsWeek = metricsAll.filter((r) =>
    rowReportDateInRange(r as Record<string, unknown>, weekStartYmd, dateYmd)
  );
  const metricsTot = metricsAll;

  const { data: metricFieldRows } = await supabaseServer
    .from('company_metric_fields')
    .select('key, label, unit, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  const metricFields: MetricFieldDef[] =
    Array.isArray(metricFieldRows) && metricFieldRows.length > 0
      ? (metricFieldRows as MetricFieldDef[])
      : FALLBACK_METRIC_FIELDS;

  const dayAgg = aggregateMetricsByFields(metricsDay, metricFields);
  const weekAgg = aggregateMetricsByFields(metricsWeek, metricFields);
  const totAgg = aggregateMetricsByFields(metricsTot, metricFields);
  const chemAll = safeRows(chemAllRes) as Record<string, unknown>[];
  const chemDayLogs = chemAll.filter((r) => rowReportDateInRange(r, dateYmd, dateYmd));
  const chemWeekLogs = chemAll.filter((r) => rowReportDateInRange(r, weekStartYmd, dateYmd));
  const chemTotLogs = chemAll.filter((r) => {
    const rd = resolveRowReportDateYmd(r);
    if (rd) return rd <= dateYmd;
    const la = r.logged_at;
    if (!la) return false;
    return String(la).slice(0, 10) <= dateYmd;
  });
  const incidents = filterRowsByReportDay(safeRows(incidentsRes) as Record<string, unknown>[], dateYmd);
  const observations = filterRowsByReportDay(safeRows(obsRes) as Record<string, unknown>[], dateYmd);
  const surveys = filterRowsByReportDay(safeRows(surveysRes) as Record<string, unknown>[], dateYmd);
  const checklists = filterRowsByReportDay(safeRows(checklistsRes) as Record<string, unknown>[], dateYmd);
  const attachments = filterRowsByReportDay(safeRows(attachRes) as Record<string, unknown>[], dateYmd).filter(
    (r) => hasCloudinaryUploadedUrls(r.cloudinary_urls)
  );
  const inventoryRows = safeRows(inventoryRes) as { name: string; quantity: number | null }[];

  const chemDayMap = aggregateChems(flattenChemicals(chemDayLogs as { chemicals?: ChemLine[] }[]));
  const chemWeekMap = aggregateChems(flattenChemicals(chemWeekLogs as { chemicals?: ChemLine[] }[]));
  const chemTotMap = aggregateChems(flattenChemicals(chemTotLogs as { chemicals?: ChemLine[] }[]));

  const applicationTypes = (chemDayLogs as { application_type?: string }[])
    .map((l) => l.application_type)
    .filter(Boolean);
  const appTypeLabel = applicationTypes[0] || '—';

  /** Site photos: attachment uploads only (not note photos). */
  const sitePhotos: ReportPhotoEntry[] = [];

  for (const a of attachments) {
    const row = a as {
      cloudinary_urls?: unknown;
      notes?: string | null;
      file_names?: unknown;
      logged_at?: string;
      created_at?: string;
    };
    const urls = parseUrlList(row.cloudinary_urls);
    if (!urls.length) continue;
    const tsIso = String(row.logged_at || row.created_at || endDate);
    const ts = new Date(tsIso).toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const description = String(row.notes || '').trim();
    const fileNames = Array.isArray(row.file_names)
      ? row.file_names.map((n) => String(n || '').trim()).filter(Boolean)
      : [];
    urls.forEach((url, idx) => {
      const fileLabel = fileNames[idx] || '';
      const caption = description || fileLabel || 'Site photo';
      sitePhotos.push({ url, ts, caption });
    });
  }

  const hasData =
    notes.length +
      metricsDay.length +
      chemDayLogs.length +
      incidents.length +
      observations.length +
      surveys.length +
      checklists.length +
      attachments.length >
    0;

  if (!hasData) {
    return new NextResponse(
      `<div style="padding:40px;font-family:sans-serif;text-align:center">
       <h2>No activity logged</h2>
       <p>No field data was logged for <b>${escapeHtml(projectName)}</b> on <b>${escapeHtml(dateParam)}</b>.</p>
    </div>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const topDate = new Date(`${dateParam}T12:00:00.000Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });

  const signedDayRowsInitial = safeRows(signedDayRes) as {
    prepared_by?: string | null;
    signed_at?: string | null;
    signature_url?: string | null;
    created_at?: string | null;
    id?: string | null;
    report_date?: string | null;
  }[];
  let signedDayRows = signedDayRowsInitial;
  if (signedDayRows.length === 0) {
    const fb = await supabaseServer
      .from('daily_signed_reports')
      .select('prepared_by, signed_at, signature_url, created_at, id, report_date')
      .eq('project_id', projectId)
      .or(signedRowDayFilterFb)
      .order('created_at', { ascending: false })
      .order('signed_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1);
    signedDayRows = safeRows(fb) as typeof signedDayRows;
  }
  const signedDailyRow = signedDayRows[0];
  const signedPreparedRaw = String(signedDailyRow?.prepared_by ?? '').trim();
  const dailySignedSigUrl = String(signedDailyRow?.signature_url ?? '').trim();
  const noteAuthor = String((notes[0] as { logged_by?: string })?.logged_by ?? '').trim();
  const preparedByRaw = signedPreparedRaw || noteAuthor || 'Field team';
  const preparedBy = await displayNameForPreparedBy(preparedByRaw);

  const isDailyReportSigned = dailySignedSigUrl.length > 0;
  const preparedByTopBar = isDailyReportSigned ? escapeHtml(preparedBy) : '__';

  const dailySignedSignatureHtml =
    dailySignedSigUrl.length > 0
      ? `<div class="daily-signed-signature-wrap">
    <img class="daily-signed-signature-img" src="${escapeHtml(dailySignedSigUrl)}" alt="Daily report signature" />
    ${
      signedDailyRow?.signed_at
        ? `<div class="daily-signed-signature-caption">${escapeHtml(
            new Date(String(signedDailyRow.signed_at)).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          )}</div>`
        : '<div class="daily-signed-signature-caption">Signed</div>'
    }
  </div>`
      : '';

  let notesPhotosDeferredPdfHtml = '';
  const notesHtml = notes
    .map((n, i) => {
      const row = n as Record<string, unknown> & { notes_text?: string; photos?: string[]; category?: string };
      const rawText = String(row.notes_text || '').trim();
      const category = String(row.category || 'Note').trim();
      const text = escapeHtml(rawText);
      const metaTs = new Date(String(row.logged_at || row.created_at || endDate));
      const reportYmd = resolveRowReportDateYmd(row);
      const reportLabel = reportYmd
        ? new Date(`${reportYmd}T12:00:00.000Z`).toLocaleDateString('en-US')
        : null;
      const photoUrls = parseUrlList(row.photos);
      let photosHtml = '';
      if (photoUrls.length > 0) {
        const grid = `<div class="note-photo-list">${photoUrls
          .map((u, pi) => buildNotePhotoHtml(u, i, pi, pdfExport))
          .join('')}</div>`;
        if (pdfExport) {
          notesPhotosDeferredPdfHtml += grid;
        } else {
          photosHtml = grid;
        }
      }
      const metaParts = [
        escapeHtml(category),
        reportLabel ? `Report ${reportLabel}` : null,
        `Submitted ${metaTs.toLocaleDateString('en-US')} ${metaTs.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      ].filter(Boolean);
      const textHtml =
        rawText.length > 0
          ? `<div class="note-item"><strong>${i + 1}. ${escapeHtml(category)}</strong> — ${text}</div>`
          : photoUrls.length > 0
            ? `<div class="note-item"><strong>${i + 1}. ${escapeHtml(category)}</strong></div>`
            : `<div class="note-item"><strong>${i + 1}.</strong> ${text}</div>`;
      return `<div class="note-block">${textHtml}${photosHtml}<div class="note-meta">${metaParts.join(' | ')}</div></div>`;
    })
    .join('');

  const notesPhotosPdfSection =
    pdfExport && notesPhotosDeferredPdfHtml
      ? `<div class="section-wrap">
    <div class="section-header">Note photos</div>
    <div class="notes-body">${notesPhotosDeferredPdfHtml}</div>
  </div>`
      : '';

  const metricRowsHtml = metricFields
    .map((f) => {
      const digits = f.key === 'water_usage' || f.key === 'number_of_operators' ? 0 : 1;
      const dayVal = dayAgg[f.key] || 0;
      const weekVal = weekAgg[f.key] || 0;
      const totVal = totAgg[f.key] || 0;
      const unit = f.unit === 'count' ? '' : f.unit;
      const showOps = f.key === 'number_of_operators';
      return `<tr>
      <td>${escapeHtml(f.label)}</td>
      <td class="td-num"><div class="val">${showOps ? dayVal || '—' : fmtNum(dayVal, digits)}</div><div class="unit">${escapeHtml(unit)}</div></td>
      <td class="td-num"><div class="val">${showOps ? weekVal || '—' : fmtNum(weekVal, digits)}</div><div class="unit">${escapeHtml(unit)}</div></td>
      <td class="td-num td-to-date"><div class="val">${showOps ? totVal || '—' : fmtNum(totVal, digits)}</div><div class="unit">${escapeHtml(unit)}</div></td>
    </tr>`;
    })
    .join('');

  const chemKeys = new Set<string>([...chemDayMap.keys(), ...chemWeekMap.keys(), ...chemTotMap.keys()]);
  const chemRowsHtml = Array.from(chemKeys)
    .map((key) => {
      const name = key.split('||')[0];
      const unit = chemDayMap.get(key)?.unit || chemWeekMap.get(key)?.unit || chemTotMap.get(key)?.unit || '';
      const d = chemDayMap.get(key)?.quantity ?? 0;
      const w = chemWeekMap.get(key)?.quantity ?? 0;
      const t = chemTotMap.get(key)?.quantity ?? 0;
      return `<tr>
      <td>${escapeHtml(name)}</td>
      <td class="td-num"><div class="val">${fmtNum(d, 2)}</div><div class="unit">${escapeHtml(unit)}</div></td>
      <td class="td-num"><div class="val">${fmtNum(w, 2)}</div><div class="unit">${escapeHtml(unit)}</div></td>
      <td class="td-num td-to-date"><div class="val">${fmtNum(t, 2)}</div><div class="unit">${escapeHtml(unit)}</div></td>
    </tr>`;
    })
    .join('');

  const incidentsHtml = incidents
    .map((row) => {
      const i = row as {
        title?: string;
        logged_at?: string;
        recordable?: boolean;
        is_recordable?: boolean;
        status?: string;
        description?: string;
        location?: string;
        injury_illness_type?: string;
        injured_employee_info?: string[];
        investigation?: string;
        corrective_action?: string;
      };
      const recordable = i.recordable ?? i.is_recordable;
      const badge =
        i.status === 'Closed'
          ? `<span class="badge badge-closed">Closed</span>`
          : recordable
            ? `<span class="badge badge-rec">Recordable</span>`
            : `<span class="badge badge-open">Open</span>`;
      const when = i.logged_at ? new Date(i.logged_at) : new Date();
      const emp =
        Array.isArray(i.injured_employee_info) && i.injured_employee_info.length
          ? i.injured_employee_info.join(', ')
          : '—';
      return `<div class="card-item">
        <div>
          <span class="card-title">${escapeHtml(i.title || 'Incident')}</span>
          ${badge}
        </div>
        <div class="grid-2">
          <div><strong>Date:</strong> ${escapeHtml(when.toLocaleDateString())}</div>
          <div><strong>Time:</strong> ${escapeHtml(when.toLocaleTimeString())}</div>
          <div class="span-2"><strong>Location:</strong> ${escapeHtml(i.location || projectName)}</div>
          <div class="span-2"><strong>Injury type:</strong> ${escapeHtml(i.injury_illness_type || '—')}</div>
        </div>
        <div class="detail"><strong>Employee info:</strong> ${escapeHtml(emp)}</div>
        <div class="detail"><strong>Description:</strong> ${escapeHtml(i.description || '')}</div>
        <div class="detail"><strong>Investigation / outcome:</strong> ${escapeHtml([i.investigation, i.corrective_action].filter(Boolean).join(' '))}</div>
      </div>`;
    })
    .join('');

  const observationsHtml = observations
    .map((row) => {
      const o = row as {
        title?: string;
        type?: string;
        status?: string;
        progress?: string;
        description?: string;
        description_tags?: string[];
        location?: string;
      };
      const title = o.title || o.type || 'Observation';
      const st = (o.status || '').toLowerCase();
      const stBadge =
        st === 'resolved'
          ? `<span class="badge badge-closed">Resolved</span>`
          : `<span class="badge badge-open">Open</span>`;
      const description = resolveObservationDescription({
        description: o.description,
        description_tags: o.description_tags,
      });
      return `<div class="card-item">
        <div>
          <span class="card-title">${escapeHtml(title)}</span>
          ${stBadge}
        </div>
        <div class="grid-2">
          <div><strong>Type:</strong> ${escapeHtml(o.type || '—')}</div>
          <div><strong>Progress:</strong> ${escapeHtml(o.progress || '—')}</div>
          <div><strong>Location:</strong> ${escapeHtml(o.location || '—')}</div>
        </div>
        <div class="detail" style="white-space:pre-wrap;"><strong>Description:</strong> ${escapeHtml(description || '—')}</div>
      </div>`;
    })
    .join('');

  const surveyHtml = surveys
    .map((s) => {
      const qs = (s as { questions?: { question?: string; answer?: string; description?: string }[] }).questions || [];
      const qHtml = qs
        .map(
          (q) => `<tr>
            <td>${escapeHtml(q.question || '')}</td>
            <td style="text-align:center;"><span class="chkbox">${q.answer === 'N/A' ? '✓' : ''}</span></td>
            <td style="text-align:center;"><span class="chkbox">${q.answer === 'No' ? '✓' : ''}</span></td>
            <td style="text-align:center;"><span class="chkbox">${q.answer === 'Yes' ? '✓' : ''}</span></td>
            <td class="italic">${escapeHtml(q.description || '')}</td>
          </tr>`
        )
        .join('');
      const logged = (s as { logged_at?: string }).logged_at;
      return `<table class="survey-table">
        <thead>
          <tr>
            <th style="text-align:left;">Questions</th>
            <th class="col-chk">N/A</th>
            <th class="col-chk">No</th>
            <th class="col-chk">Yes</th>
            <th style="text-align:left;">Description</th>
          </tr>
        </thead>
        <tbody>${qHtml}</tbody>
      </table>
      <div class="note-meta" style="margin-top:10px;">${logged ? escapeHtml(new Date(logged).toLocaleString()) : ''}</div>
      <hr style="margin:20px 0;border:0;border-top:1px solid #eee;" />`;
    })
    .join('');

  const checkHtml = checklists
    .map((chk) => {
      const row = chk as Record<string, unknown>;
      const meta = normalizeEquipmentChecklistRow(row);
      const fields = equipmentChecklistFormDisplayFields(row);
      const when = meta.loggedAt ? new Date(meta.loggedAt) : new Date();
      const reportDay = meta.reportDateYmd || when.toLocaleDateString();
      const cells = fields
        .map((f) => `<div><strong>${escapeHtml(f.label)}:</strong> ${escapeHtml(f.value)}</div>`)
        .join('');
      return `<div class="card-body" style="margin-bottom:12px;">
      <div class="checklist-grid">
        ${cells || `<div><strong>Operator:</strong> ${escapeHtml(meta.operatorName || '—')}</div>`}
      </div>
      ${meta.signatureUrl ? `<img class="sig-img" src="${escapeHtml(meta.signatureUrl)}" alt="Operator signature" />` : ''}
      <div class="note-meta" style="margin-top:6px;">Report ${escapeHtml(reportDay)} · logged ${escapeHtml(when.toLocaleString())}</div>
    </div>`;
    })
    .join('');

  // One grid per upload batch (same timestamp) with a single line underneath, like notes.
  const photoBatches = new Map<string, ReportPhotoEntry[]>();
  for (const p of sitePhotos) {
    const arr = photoBatches.get(p.ts) ?? [];
    arr.push(p);
    photoBatches.set(p.ts, arr);
  }
  let photoIdx = 0;
  const photosHtml = [...photoBatches.entries()]
    .map(([ts, batch]) => {
      const thumbs = batch.map((p) => buildSitePhotoHtml(p, photoIdx++, pdfExport)).join('');
      return `<div class="photo-batch">
        <div class="photo-grid">${thumbs}</div>
        <div class="note-meta">Submitted ${escapeHtml(ts)}</div>
      </div>`;
    })
    .join('');

  const weatherSection = buildWeatherSectionHtml(dateParam, dayWeather, projectRow);

  const metricsSection =
    metricsDay.length > 0
      ? `<div class="section-wrap">
    <div class="section-header">Metrics</div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Day total</th>
            <th>Week total</th>
            <th class="th-to-date">Quantities to date</th>
          </tr>
        </thead>
        <tbody>${metricRowsHtml}</tbody>
      </table>
    </div>
  </div>`
      : '';

  const chemicalsSection =
    chemRowsHtml.length > 0
      ? `<div class="section-wrap">
    <div class="section-header">Chemicals</div>
    <div class="table-wrap">
      <div class="app-type-row">
        <span class="app-type-label">Application type:</span>
        <span class="badge badge-orange">${escapeHtml(appTypeLabel)}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Day total</th>
            <th>Week total</th>
            <th class="th-to-date">Quantities to date</th>
          </tr>
        </thead>
        <tbody>${chemRowsHtml}</tbody>
      </table>
    </div>
  </div>`
      : '';

  const inventorySection = buildInventoryHtml(inventoryRows);

  const signatureRefs = collectDaySignatureRefs(metricsDay, chemDayLogs, checklists);
  const signatureGalleryHtml =
    signatureRefs.length > 0
      ? `<div class="signature-gallery">${signatureRefs
          .map(
            (s) => `<div class="sig-unit">
            <img src="${escapeHtml(s.url)}" alt="" style="max-width:220px;height:56px;object-fit:contain;border-bottom:2px solid #000;" />
            <div class="sig-meta">${escapeHtml(s.label)}</div>
          </div>`
          )
          .join('')}</div>`
      : '';

  const brandLogo = await getCompanyBrandLogoForReport();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily Field Report – ${escapeHtml(projectName)}</title>
  <style>${REPORT_CSS}${pdfExport ? REPORT_PDF_EXPORT_CSS : ''}</style>
</head>
<body>
<div class="report-sheet${pdfExport ? ' report-sheet-pdf' : ''}">
  <div class="top-bar">
    <span>Date ${escapeHtml(topDate)}</span>
    <span>${jobLabel}</span>
    <span>Prepared by ${preparedByTopBar}</span>
  </div>

  <div class="report-header">
    <div>
      <h1>${escapeHtml(projectName)}</h1>
      <p>${escapeHtml(projectDisplayLocation)}</p>
    </div>
    ${
      brandLogo.src
        ? `<div class="report-brand-logo-wrap">
      <img
        class="report-brand-logo"
        src="${escapeHtml(brandLogo.src)}"
        alt="${escapeHtml(brandLogo.alt)}"
        width="300"
        height="64"
        loading="lazy"
        decoding="async"
      />
    </div>`
        : ''
    }
  </div>

  ${weatherSection}

  ${
    notesHtml
      ? `<div class="section-wrap">
    <div class="section-header">General notes</div>
    <div class="notes-body">${notesHtml}</div>
  </div>`
      : ''
  }

  ${metricsSection}

  ${chemicalsSection}

  ${notesPhotosPdfSection}

  ${inventorySection}

  ${
    incidentsHtml
      ? `<div class="section-wrap">
    <div class="section-header">Incidents</div>
    <div class="card-body">${incidentsHtml}</div>
  </div>`
      : ''
  }

  ${
    observationsHtml
      ? `<div class="section-wrap">
    <div class="section-header">Observations</div>
    <div class="card-body">${observationsHtml}</div>
  </div>`
      : ''
  }

  ${
    checkHtml
      ? `<div class="section-wrap" style="margin-top:32px;">
    <div class="section-header">Equipment checklist</div>
    ${checkHtml}
  </div>`
      : ''
  }

  ${
    photosHtml
      ? `<div class="section-wrap">
    <div class="section-header">Site photos</div>
    <div style="padding:16px 0;">
      ${photosHtml}
    </div>
  </div>`
      : ''
  }

  ${
    surveyHtml
      ? `<div class="section-wrap">
    <div class="section-header">Survey</div>
    <div class="survey-body">${surveyHtml}</div>
  </div>`
      : ''
  }

  <div class="signature-block">
    ${dailySignedSignatureHtml}
    ${
      isDailyReportSigned
        ? `<p>I, ${escapeHtml(preparedBy)}, have reviewed the field data recorded for this day.</p>`
        : ''
    }
    ${signatureGalleryHtml}
  </div>

  <div class="report-footer">
    <span>WICK&apos;D ENVIRONMENTAL TECHNOLOGIES</span><br />
    ${escapeHtml(projectName)}
  </div>
</div>
${REPORT_PHOTO_DOWNLOAD_SCRIPT}
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
