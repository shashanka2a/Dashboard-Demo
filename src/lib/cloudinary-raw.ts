/**
 * Cloudinary non-image / non-video assets (e.g. PDF) must use resource type **raw**:
 *
 * - **REST:** `POST https://api.cloudinary.com/v1_1/<cloud_name>/raw/upload`
 * - **Do not call from the browser** — Cloudinary raw uploads often fail CORS on custom domains.
 *   Use `/api/safety-talks/upload` (server-side) instead.
 * - **Node SDK:** pass `{ resource_type: 'raw', ... }` to `uploader.upload` / `upload_stream`.
 *
 * Do not use `/image/upload` or omit `resource_type` for PDFs — uploads will fail or be misclassified.
 */

/** Signed or unsigned multipart POST target for raw files. */
export function cloudinaryRawUploadApiUrl(cloudName: string): string {
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/raw/upload`;
}

/** Shared SDK options for PDF / document uploads (merge with `folder`, `public_id`, etc.). */
export const cloudinaryRawSdkUploadFields = { resource_type: 'raw' as const };

export type CloudinaryRawUploadResult = {
  secure_url: string;
  public_id: string;
  bytes?: number;
};

/** Server-side signed raw upload via Cloudinary SDK (bypasses unsigned preset restrictions). */
export async function uploadRawViaSignedSdk(
  buffer: Buffer,
  opts: {
    folder: string;
    filename?: string;
  }
): Promise<CloudinaryRawUploadResult> {
  // Lazy import to avoid pulling cloudinary into edge runtimes.
  const { default: cloudinary } = await import('@/lib/cloudinary');

  const name = (opts.filename || 'document.bin').trim();
  const base = name.replace(/\.[^.]+$/, '');

  const result = await new Promise<{ secure_url?: string; public_id?: string; bytes?: number }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: opts.folder,
          use_filename: true,
          unique_filename: true,
          public_id: base || undefined,
        },
        (err, res) => {
          if (err) return reject(err);
          resolve((res ?? {}) as { secure_url?: string; public_id?: string; bytes?: number });
        }
      );
      stream.end(buffer);
    }
  );

  if (!result.secure_url || !result.public_id) {
    throw new Error('Cloudinary raw upload returned no URL');
  }
  return { secure_url: result.secure_url, public_id: result.public_id, bytes: result.bytes };
}

/** Server-side unsigned raw upload (preset must allow Raw + folder). Avoids signed API 403 on some accounts. */
export async function uploadRawViaUnsignedPreset(
  buffer: Buffer,
  opts: {
    cloudName: string;
    uploadPreset: string;
    folder: string;
    filename?: string;
    mimeType?: string;
  }
): Promise<CloudinaryRawUploadResult> {
  const formData = new FormData();
  formData.append(
    'file',
    new Blob([new Uint8Array(buffer)], { type: opts.mimeType || 'application/octet-stream' }),
    opts.filename || 'document.bin'
  );
  formData.append('upload_preset', opts.uploadPreset);
  formData.append('folder', opts.folder);

  const res = await fetch(cloudinaryRawUploadApiUrl(opts.cloudName), { method: 'POST', body: formData });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Cloudinary preset upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message || text.slice(0, 200);
    throw new Error(msg);
  }
  const row = data as { secure_url?: string; public_id?: string; bytes?: number };
  if (!row.secure_url || !row.public_id) {
    throw new Error('Cloudinary preset upload returned no URL');
  }
  return {
    secure_url: row.secure_url,
    public_id: row.public_id,
    bytes: row.bytes,
  };
}
