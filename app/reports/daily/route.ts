import { NextRequest } from 'next/server';

/**
 * `/reports/daily` — HTML daily report (fast interactive preview).
 *
 * For the same layout as dashboard PDF download, use `/reports/daily/pdf` instead
 * (`preview=1` inline, default attachment). See `src/lib/daily-report-urls.ts`.
 *
 * Query: `date=YYYY-MM-DD`, `project_id=<uuid>` or `project=<name>`
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const apiUrl = new URL('/api/reports/daily', url.origin);
  apiUrl.search = url.search; // forward all query params

  const res = await fetch(apiUrl.toString(), {
    method: 'GET',
    // Ensure we always bypass any edge caching during previews
    cache: 'no-store',
  });

  const html = await res.text();
  return new Response(html, {
    status: res.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Prevent caching stale HTML across projects/dates on mobile previews.
      'Cache-Control': 'no-store',
    },
  });
}

