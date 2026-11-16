/**
 * Safety talk PDFs are Cloudinary **raw** assets (not image). See `@/lib/cloudinary-raw`.
 */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';
import {
  cloudinaryRawSdkUploadFields,
  cloudinaryRawUploadApiUrl,
  uploadRawViaUnsignedPreset,
} from '@/lib/cloudinary-raw';

/** Keep in sync with Cloudinary upload preset folder (Resource type: Raw). */
const SAFETY_TALKS_FOLDER =
  process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() ||
  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_FOLDER?.trim() ||
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_FOLDER?.trim() ||
  'safety-talks';

function uploadPresetName(): string | undefined {
  const p =
    process.env.CLOUDINARY_UPLOAD_PRESET?.trim() ||
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() ||
    process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();
  return p || undefined;
}

/** Node runtime: writable `/tmp` + reliable Cloudinary file upload. */
export const runtime = 'nodejs';

/** Large PDFs on Vercel may need a longer function timeout (Pro plan may allow up to 300s). */
export const maxDuration = 60;

/** WebViews / embedded browsers may POST cross-origin; allow dashboard + RN shells to read JSON errors. */
function cors(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: cors() });
}

/** Same env fallbacks as `@/lib/cloudinary` so Vercel can use EXPO_PUBLIC_* or NEXT_PUBLIC_* if CLOUDINARY_* is unset. */
function cloudinaryEnv() {
  const cloud_name =
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const api_key =
    process.env.CLOUDINARY_API_KEY ||
    process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY ||
    process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
  const api_secret =
    process.env.CLOUDINARY_API_SECRET ||
    process.env.EXPO_PUBLIC_CLOUDINARY_API_SECRET ||
    process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET;
  return { cloud_name, api_key, api_secret };
}

function isPdfFile(file: File): boolean {
  const name = (file.name || '').toLowerCase();
  if (!name.endsWith('.pdf')) return false;
  const t = (file.type || '').toLowerCase();
  if (t === 'application/pdf') return true;
  if (t === '' || t === 'application/octet-stream') return true;
  return false;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const o = err as { message?: unknown; error?: { message?: string }; http_code?: number };
    if (typeof o.message === 'string') return o.message;
    if (o.error?.message) return String(o.error.message);
  }
  try {
    return JSON.stringify(err);
  } catch {
    return 'Upload failed';
  }
}

type UploadResult = { secure_url: string; public_id: string; bytes?: number };

function assertUploadResult(res: UploadResult | undefined): UploadResult {
  if (!res?.secure_url || !res.public_id) {
    throw new Error('Cloudinary returned no secure_url or public_id (check raw upload settings).');
  }
  return res;
}

function uploadRawFromPath(tmpPath: string, folder: string, publicId: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      tmpPath,
      {
        ...cloudinaryRawSdkUploadFields,
        folder,
        public_id: publicId,
      },
      (error, res) => {
        if (error) reject(error);
        else if (res) {
          try {
            resolve(assertUploadResult(res as UploadResult));
          } catch (e) {
            reject(e);
          }
        } else reject(new Error('Empty Cloudinary response'));
      }
    );
  });
}

/**
 * Buffer upload — use `stream.end(buffer)` instead of piping from Readable; more reliable on Vercel/serverless.
 */
function uploadRawFromStream(buffer: Buffer, folder: string, publicId: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        ...cloudinaryRawSdkUploadFields,
        folder,
        public_id: publicId,
      },
      (error, res) => {
        if (error) reject(error);
        else if (res) {
          try {
            resolve(assertUploadResult(res as UploadResult));
          } catch (e) {
            reject(e);
          }
        } else reject(new Error('Empty Cloudinary response'));
      }
    );
    uploadStream.on('error', reject);
    uploadStream.end(buffer);
  });
}

/** Fallback when temp-file upload fails on some hosts (SDK reads path asynchronously). Max ~9MB base64. */
function uploadRawFromBase64(buffer: Buffer, folder: string, publicId: string): Promise<UploadResult> {
  const maxBytes = 9 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    return Promise.reject(new Error('File too large for fallback upload; try direct Cloudinary preset or smaller PDF.'));
  }
  const dataUri = `data:application/pdf;base64,${buffer.toString('base64')}`;
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      dataUri,
      {
        ...cloudinaryRawSdkUploadFields,
        folder,
        public_id: publicId,
      },
      (error, res) => {
        if (error) reject(error);
        else if (res) {
          try {
            resolve(assertUploadResult(res as UploadResult));
          } catch (e) {
            reject(e);
          }
        } else reject(new Error('Empty Cloudinary response'));
      }
    );
  });
}

/** Last resort: signed multipart to Cloudinary REST API (same semantics as dashboard upload form). */
async function uploadRawViaRestApi(
  buffer: Buffer,
  cloud_name: string,
  api_key: string,
  api_secret: string,
  folder: string,
  publicId: string
): Promise<UploadResult> {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = {
    timestamp,
    folder,
    public_id: publicId,
  };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, api_secret);

  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }), 'document.pdf');
  formData.append('api_key', api_key);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  formData.append('folder', folder);
  formData.append('public_id', publicId);

  const url = cloudinaryRawUploadApiUrl(cloud_name);
  const res = await fetch(url, { method: 'POST', body: formData });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Cloudinary REST upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message || text;
    throw new Error(msg);
  }
  return assertUploadResult(data as UploadResult);
}

/** Signed SDK / REST fallbacks when unsigned preset is unavailable or fails. */
async function uploadRawSigned(
  buffer: Buffer,
  cloud_name: string,
  api_key: string,
  api_secret: string,
  basePublicId: string,
  tmpPath: string
): Promise<UploadResult> {
  try {
    return await uploadRawFromPath(tmpPath, SAFETY_TALKS_FOLDER, basePublicId);
  } catch (firstErr) {
    console.warn('[safety-talks/upload] path upload failed, trying stream:', errorMessage(firstErr));
    try {
      return await uploadRawFromStream(buffer, SAFETY_TALKS_FOLDER, basePublicId);
    } catch (secondErr) {
      console.warn('[safety-talks/upload] stream upload failed, trying base64:', errorMessage(secondErr));
      try {
        return await uploadRawFromBase64(buffer, SAFETY_TALKS_FOLDER, `${basePublicId}-fb`);
      } catch (thirdErr) {
        console.warn('[safety-talks/upload] base64 failed, trying signed REST:', errorMessage(thirdErr));
        return uploadRawViaRestApi(
          buffer,
          cloud_name,
          api_key,
          api_secret,
          SAFETY_TALKS_FOLDER,
          `${basePublicId}-api`
        );
      }
    }
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

/**
 * Upload safety talk PDFs to Cloudinary as raw assets.
 */
export async function POST(req: NextRequest) {
  try {
    const { cloud_name, api_key, api_secret } = cloudinaryEnv();
    if (!cloud_name || !api_key || !api_secret) {
      const missing: string[] = [];
      if (!cloud_name) missing.push('CLOUDINARY_CLOUD_NAME (or NEXT_PUBLIC_/EXPO_PUBLIC_)');
      if (!api_key) missing.push('CLOUDINARY_API_KEY (or NEXT_PUBLIC_/EXPO_PUBLIC_)');
      if (!api_secret) missing.push('CLOUDINARY_API_SECRET (or NEXT_PUBLIC_/EXPO_PUBLIC_)');
      // 503: missing server Cloudinary config (not an upload failure).
      return json(
        {
          error: `Cloudinary is not fully configured on the server. Set: ${missing.join(', ')} on the host.`,
        },
        503
      );
    }

    cloudinary.config({
      cloud_name,
      api_key,
      api_secret,
      secure: true,
    });

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e) {
      const msg = errorMessage(e);
      console.error('[safety-talks/upload] formData failed:', e);
      if (/body|limit|size|parse/i.test(msg)) {
        return json(
          {
            error:
              'Request body too large or unreadable. Try a smaller PDF (under 50 MB).',
          },
          413
        );
      }
      return json({ error: msg }, 400);
    }

    const file = formData.get('file') as File | null;

    if (!file) {
      return json({ error: 'No file provided' }, 400);
    }

    if (!isPdfFile(file)) {
      return json(
        { error: 'Only PDF files are allowed (use a .pdf file; some browsers omit MIME type).' },
        400
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      return json({ error: 'File exceeds 50MB limit' }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return json({ error: 'Empty file' }, 400);
    }

    const stamp = Date.now();
    const basePublicId = `stk-${stamp}`;
    const tmpPath = path.join(os.tmpdir(), `safety-talk-${stamp}-${Math.random().toString(36).slice(2, 10)}.pdf`);
    await fs.writeFile(tmpPath, buffer);

    let result: UploadResult;
    const preset = uploadPresetName();
    try {
      if (preset) {
        try {
          result = await uploadRawViaUnsignedPreset(buffer, {
            cloudName: cloud_name,
            uploadPreset: preset,
            folder: SAFETY_TALKS_FOLDER,
            filename: file.name || 'document.pdf',
          });
        } catch (presetErr) {
          console.warn('[safety-talks/upload] preset upload failed, trying signed SDK:', errorMessage(presetErr));
          result = await uploadRawSigned(buffer, cloud_name, api_key, api_secret, basePublicId, tmpPath);
        }
      } else {
        result = await uploadRawSigned(buffer, cloud_name, api_key, api_secret, basePublicId, tmpPath);
      }
    } finally {
      await fs.unlink(tmpPath).catch(() => {});
    }

    return json({
      pdf_url: result.secure_url,
      pdf_public_id: result.public_id,
      file_size: result.bytes ?? file.size,
      name: file.name.replace(/\.pdf$/i, ''),
    });
  } catch (err: unknown) {
    let message = errorMessage(err);
    const lower = message.toLowerCase();
    const httpCode =
      typeof err === 'object' && err !== null && 'http_code' in err
        ? Number((err as { http_code?: number }).http_code)
        : undefined;

    if (httpCode === 401 || lower.includes('invalid api key') || lower.includes('signature')) {
      message = 'Cloudinary rejected authentication (check API key and secret on Vercel).';
    } else if (httpCode === 403 || lower.includes('not allowed') || lower.includes('forbidden')) {
      message =
        'Cloudinary denied this upload (403). Ensure CLOUDINARY_UPLOAD_PRESET (or EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET) is an unsigned Raw preset, or fix API key/secret for signed uploads.';
    } else if (lower.includes('timed out') || lower.includes('timeout')) {
      message = 'Upload timed out. Try a smaller PDF or retry.';
    }
    console.error('[safety-talks/upload]', err);
    return json({ error: message }, 500);
  }
}
