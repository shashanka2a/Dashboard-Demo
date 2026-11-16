import { getCompanyBrandLogoForReport } from '@/lib/company-brand';
import type { JsaCrewSignature, JsaFormRow, JsaHazardRow } from '@/lib/jsa-types';
import { jsaRiskLabel } from '@/lib/jsa-risk';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const REPORT_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #555; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .report-sheet { width: 100%; max-width: 850px; margin: 40px auto 60px; background: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.35); position: relative; padding-bottom: 40px; }
  .top-bar { background: #000; color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 10px 28px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; flex-wrap: wrap; gap: 8px; }
  .report-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 24px 28px; border-bottom: 1px solid #e0e0e0; }
  .report-header h1 { font-size: 22px; font-weight: 700; color: #222; margin-bottom: 4px; }
  .report-header p { font-size: 13px; color: #666; }
  .report-brand-logo-wrap { flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end; max-width: min(100%, 340px); margin-left: 12px; }
  .report-brand-logo { max-height: 52px; max-width: 100%; width: auto; height: auto; object-fit: contain; display: block; }
  .section-header { background: #FF6633; color: #fff; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 16px; }
  .section-wrap { padding: 0 28px; margin-top: 20px; }
  .section-body { padding: 14px 0; font-size: 13px; line-height: 1.5; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; padding: 16px 28px; border-bottom: 1px solid #eee; font-size: 13px; }
  .meta-grid .label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #999; letter-spacing: 0.04em; margin-bottom: 2px; }
  .meta-grid .value { font-weight: 600; color: #222; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
  .chip { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1.5px solid #ddd; color: #666; background: #f9f9f9; }
  .chip.selected { border-color: #FF6633; background: #FFF3EF; color: #FF6633; }
  .hint { font-size: 12px; color: #888; font-style: italic; margin-bottom: 8px; }
  .field-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #999; letter-spacing: 0.04em; margin-bottom: 4px; }
  .field-value { font-size: 13px; color: #222; white-space: pre-wrap; }
  .hazard-card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px 14px; margin-bottom: 10px; }
  .hazard-level { font-size: 13px; font-weight: 600; color: #444; margin: 2px 0 10px; }
  .hazard-level span { font-weight: 800; }
  .hazard-level .level-L { color: #2E7D32; }
  .hazard-level .level-M { color: #E65100; }
  .hazard-level .level-H { color: #C62828; }
  .hazard-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
  .hazard-title { font-weight: 700; font-size: 14px; color: #222; }
  .risk-badge { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 4px; font-weight: 800; font-size: 13px; color: #fff; flex-shrink: 0; }
  .risk-L { background: #4CAF50; }
  .risk-M { background: #FFC107; color: #333; }
  .risk-H { background: #F44336; }
  .stop-work-box { border: 2px solid #FF6633; border-radius: 6px; padding: 14px 16px; margin-bottom: 12px; background: #FFF8F5; }
  .stop-work-box .statement { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px; }
  .stop-work-box .confirmed { font-size: 12px; color: #2E7D32; font-weight: 700; }
  .stop-work-box .not-confirmed { font-size: 12px; color: #999; }
  .sig-grid { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; }
  .sig-unit { text-align: center; }
  .sig-unit img { max-width: 200px; height: 56px; object-fit: contain; border-bottom: 2px solid #000; display: block; margin: 0 auto 4px; }
  .sig-meta { font-size: 11px; color: #666; }
  .report-footer { text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; padding: 16px 28px 20px; margin-top: 32px; }
  .report-footer span { font-weight: 900; letter-spacing: 0.1em; color: #FF6633; }
  @media print {
    body { background: #fff; }
    .report-sheet { margin: 0; box-shadow: none; max-width: none; }
  }
  /* Never split a box across pages; move it to the next page (leaving whitespace) instead.
     Applied for all print/PDF output, so web and mobile downloads match. */
  @media print {
    .section-header { break-after: avoid; page-break-after: avoid; }
    .hazard-card, .stop-work-box, .sig-unit, .chip, .meta-grid,
    .field-label, .field-value, .hazard-title, .hazard-level {
      break-inside: avoid; page-break-inside: avoid;
    }
    .hazard-title, .hazard-level, .field-label { break-after: avoid; page-break-after: avoid; }
    .report-footer { break-inside: avoid; page-break-inside: avoid; }
  }
`;

/** Report (work) day like the daily report header, e.g. "Tue, 09/15/2026" — not the signed time. */
function formatReportDay(reportDate: string): string {
  const ymd = String(reportDate ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '—';
  return new Date(`${ymd}T12:00:00.000Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Only the options that were actually selected / completed. */
function buildSelectedChips(items: string[], selected: Set<string>): string {
  const chosen = items.filter((name) => selected.has(name));
  // Include selected values that are no longer in the company list.
  for (const name of selected) if (!chosen.includes(name)) chosen.push(name);
  if (chosen.length === 0) return '<span style="color:#999;">None selected</span>';
  return chosen.map((name) => `<span class="chip selected">${escapeHtml(name)}</span>`).join('');
}

function buildHazardsHtml(hazards: JsaHazardRow[]): string {
  if (!hazards.length) {
    return '<p style="color:#999;font-size:13px;">No hazards recorded.</p>';
  }
  return hazards
    .map(
      (h) => `<div class="hazard-card">
      <div class="hazard-title">${escapeHtml(h.hazard || '—')}</div>
      <div class="hazard-level">Hazard Level: <span class="level-${escapeHtml(h.risk_level)}">${escapeHtml(jsaRiskLabel(h.risk_level))}</span></div>
      <div class="field-label">Control measure</div>
      <div class="field-value">${escapeHtml(h.control_measure || '—')}</div>
    </div>`
    )
    .join('');
}

function buildSignaturesHtml(sigs: JsaCrewSignature[]): string {
  if (!sigs.length) return '';
  return `<div class="sig-grid">${sigs
    .map((s) => {
      const name = escapeHtml(s.name || 'Crew member');
      const img = s.signature_url
        ? `<img src="${escapeHtml(s.signature_url)}" alt="" />`
        : `<div style="width:180px;height:56px;border-bottom:2px solid #ccc;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:11px;">No signature</div>`;
      const when = s.signed_at
        ? new Date(s.signed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
        : '';
      return `<div class="sig-unit">${img}<div class="sig-meta">${name}${when ? `<br/>${escapeHtml(when)}` : ''}</div></div>`;
    })
    .join('')}</div>`;
}

export async function buildJsaReportHtml(opts: {
  form: JsaFormRow;
  hazards: JsaHazardRow[];
  projectName: string;
  allObjectives: string[];
  allChecks: string[];
}): Promise<string> {
  const { form, hazards, projectName, allObjectives, allChecks } = opts;
  const brandLogo = await getCompanyBrandLogoForReport();

  const siteName = form.site_name?.trim() || projectName;
  const selectedObj = new Set(form.selected_objectives ?? []);
  const completedChecks = new Set(form.completed_checks ?? []);

  const objectivesList = allObjectives.length > 0 ? allObjectives : [...selectedObj];
  const checksList = allChecks.length > 0 ? allChecks : [...completedChecks];

  const reportDay = formatReportDay(form.report_date);
  const isSigned = form.status === 'signed' || Boolean(form.signed_at);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JSA &amp; Pre-Brief – ${escapeHtml(siteName)}</title>
  <style>${REPORT_CSS}</style>
</head>
<body>
<div class="report-sheet">
  <div class="top-bar">
    <span>Date ${escapeHtml(reportDay)}</span>
    <span>JSA &amp; PRE-BRIEF</span>
    <span>${isSigned ? 'Signed' : 'Draft'}</span>
  </div>

  <div class="report-header">
    <div>
      <h1>${escapeHtml(siteName)}</h1>
      <p>${escapeHtml(brandLogo.alt)} &bull; JSA &amp; PRE-BRIEF</p>
    </div>
    ${
      brandLogo.src
        ? `<div class="report-brand-logo-wrap">
      <img class="report-brand-logo" src="${escapeHtml(brandLogo.src)}" alt="${escapeHtml(brandLogo.alt)}" loading="lazy" decoding="async" />
    </div>`
        : ''
    }
  </div>

  <div class="meta-grid">
    <div><div class="label">Site Name</div><div class="value">${escapeHtml(siteName)}</div></div>
    <div><div class="label">Client</div><div class="value">${escapeHtml(form.client_name || '—')}</div></div>
    <div><div class="label">Field Supervisor</div><div class="value">${escapeHtml(form.field_supervisor || '—')}</div></div>
    <div><div class="label">Report Date</div><div class="value">${escapeHtml(reportDay)}</div></div>
    <div style="grid-column: 1 / -1;"><div class="label">Gate GPS Coordinates</div><div class="value">${escapeHtml(form.gate_gps_coordinates || '—')}</div></div>
  </div>

  <div class="section-wrap">
    <div class="section-header">1. The Mission (The Brief)</div>
    <div class="section-body">
      <div class="field-label">Today&apos;s Objective</div>
      <div class="chip-row">${buildSelectedChips(objectivesList, selectedObj)}</div>
      <div style="margin-top:14px;">
        <div class="field-label">Specific Areas</div>
        <div class="field-value">${escapeHtml(form.specific_areas || '—')}</div>
      </div>
      <div style="margin-top:14px;">
        <div class="field-label">Success Look-back</div>
        <div class="field-value">${escapeHtml(form.success_lookback || '—')}</div>
      </div>
    </div>
  </div>

  <div class="section-wrap">
    <div class="section-header">2. Job Safety Analysis</div>
    <div class="section-body">${buildHazardsHtml(hazards)}</div>
  </div>

  <div class="section-wrap">
    <div class="section-header">3. Equipment &amp; Chemical Checks</div>
    <div class="section-body">
      <div class="chip-row">${buildSelectedChips(checksList, completedChecks)}</div>
    </div>
  </div>

  <div class="section-wrap">
    <div class="section-header">4. Emergency &amp; Communication</div>
    <div class="section-body">
      <div style="margin-bottom:12px;">
        <div class="field-label">First Aid Location</div>
        <div class="field-value">${escapeHtml(form.first_aid_location || '—')}</div>
      </div>
      <div style="margin-bottom:12px;">
        <div class="field-label">Nearest Hospital Location</div>
        <div class="field-value">${escapeHtml(form.nearest_hospital || '—')}</div>
      </div>
      <div>
        <div class="field-label">Emergency Signal</div>
        <div class="field-value">${escapeHtml(form.emergency_signal || '—')}</div>
      </div>
    </div>
  </div>

  <div class="section-wrap">
    <div class="section-header">5. Team &quot;Huddle&quot; Confirmation</div>
    <div class="section-body">
      <div class="stop-work-box">
        <div class="statement">I have the authority and responsibility to stop any task I feel is unsafe.</div>
        <div class="${form.stop_work_authority_confirmed ? 'confirmed' : 'not-confirmed'}">
          ${form.stop_work_authority_confirmed ? '&#10003; Verified — read to crew and understood' : 'Not confirmed'}
        </div>
      </div>
      <div>
        <div class="field-label">The &quot;One Thing&quot; (Single most dangerous factor today)</div>
        <div class="field-value">${escapeHtml(form.one_thing_dangerous || '—')}</div>
      </div>
      ${buildSignaturesHtml(form.crew_signatures ?? [])}
    </div>
  </div>

  <div class="report-footer">
    <span>WICK&apos;D ENVIRONMENTAL TECHNOLOGIES</span><br />
    ${escapeHtml(projectName)}
  </div>
</div>
</body>
</html>`;

  return html;
}
