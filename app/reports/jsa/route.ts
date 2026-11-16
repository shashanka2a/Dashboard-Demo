import { NextRequest } from 'next/server';

/** `/reports/jsa` — HTML JSA report (proxies API route). */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const apiUrl = new URL('/api/reports/jsa', url.origin);
  apiUrl.search = url.search;

  const res = await fetch(apiUrl.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  const html = await res.text();
  return new Response(html, {
    status: res.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
