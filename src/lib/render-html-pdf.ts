import type { Browser, PDFOptions } from 'puppeteer-core';

/** Sparticuz pack matching `@sparticuz/chromium` in package.json — fallback if `bin/` was not traced. */
const SPARTICUZ_CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL?.trim() ||
  'https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar';

function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV);
}

async function resolveSparticuzExecutablePath(): Promise<string> {
  const chromium = (await import('@sparticuz/chromium')).default;
  chromium.setGraphicsMode = false;

  try {
    return await chromium.executablePath();
  } catch (localErr) {
    console.warn('[render-html-pdf] bundled chromium bin missing, downloading pack:', localErr);
    return chromium.executablePath(SPARTICUZ_CHROMIUM_PACK_URL);
  }
}

/** Launch Chromium for HTML → PDF (local dev or Vercel/serverless). */
export async function launchPdfBrowser(): Promise<Browser> {
  const puppeteerCore = await import('puppeteer-core');
  const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (executablePath) {
    return puppeteerCore.default.launch({
      executablePath,
      headless: true,
      args: launchArgs,
    });
  }

  if (isServerlessRuntime()) {
    const chromium = (await import('@sparticuz/chromium')).default;
    chromium.setGraphicsMode = false;
    const execPath = await resolveSparticuzExecutablePath();
    return puppeteerCore.default.launch({
      args: [...chromium.args, ...launchArgs],
      executablePath: execPath,
      headless: true,
    });
  }

  try {
    const puppeteer = await import('puppeteer');
    return puppeteer.default.launch({
      headless: true,
      args: launchArgs,
    });
  } catch {
    return puppeteerCore.default.launch({
      channel: 'chrome',
      headless: true,
      args: launchArgs,
    });
  }
}

const DEFAULT_PDF_OPTS: PDFOptions = {
  format: 'a4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
};

async function waitForImagesOnPage(page: import('puppeteer-core').Page): Promise<void> {
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          window.setTimeout(done, 8000);
        });
      })
    );
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  });
}

/** Render HTML string to PDF (preferred — avoids flaky `networkidle` navigation). */
export async function renderHtmlToPdfBuffer(
  html: string,
  options?: { baseUrl?: string; pdf?: PDFOptions }
): Promise<Buffer> {
  const browser = await launchPdfBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 850, height: 1200, deviceScaleFactor: 1 });

    await page.emulateMediaType('print');

    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 90_000,
      ...(options?.baseUrl ? { url: options.baseUrl } : {}),
    });

    await page.evaluate(async () => {
      const step = Math.max(400, Math.floor(window.innerHeight * 0.85));
      for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => window.setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });

    await waitForImagesOnPage(page);

    const pdf = await page.pdf({ ...DEFAULT_PDF_OPTS, ...options?.pdf });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * Load report HTML over HTTP, then print to PDF.
 */
export async function renderUrlToPdfBuffer(
  pageUrl: string,
  options?: { waitSelector?: string; pdf?: PDFOptions }
): Promise<Buffer> {
  const res = await fetch(pageUrl, {
    cache: 'no-store',
    headers: { Accept: 'text/html', 'User-Agent': 'UtilityVisionDailyReportPdf/1.0' },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Could not load report HTML (${res.status}). ${body.slice(0, 180).replace(/\s+/g, ' ')}`
    );
  }

  const html = await res.text();
  if (!html.includes('report-sheet')) {
    throw new Error('Report HTML did not contain the expected layout.');
  }

  return renderHtmlToPdfBuffer(html, { baseUrl: pageUrl, pdf: options?.pdf });
}
