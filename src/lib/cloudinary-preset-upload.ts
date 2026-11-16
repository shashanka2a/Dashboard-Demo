/** Unsigned Cloudinary uploads (preset). Signed SDK uploads return 403 on some accounts. */

export type CloudinaryPresetUploadResult = {
  secure_url: string;
  public_id: string;
  bytes?: number;
};

export function cloudinaryUploadPresetName(): string | undefined {
  const p =
    process.env.CLOUDINARY_UPLOAD_PRESET?.trim() ||
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() ||
    process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();
  return p || undefined;
}

export function cloudinaryCloudName(): string | undefined {
  return (
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME
  );
}

function imageMime(filename: string, fileType?: string): string {
  const t = (fileType || '').toLowerCase();
  if (t.startsWith('image/')) return t;
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  return map[ext] || 'application/octet-stream';
}

export async function uploadImageViaUnsignedPreset(
  buffer: Buffer,
  opts: {
    cloudName: string;
    uploadPreset: string;
    folder: string;
    filename?: string;
    mimeType?: string;
  }
): Promise<CloudinaryPresetUploadResult> {
  const name = opts.filename || 'image.png';
  const mime = opts.mimeType || imageMime(name);
  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), name);
  formData.append('upload_preset', opts.uploadPreset);
  formData.append('folder', opts.folder);

  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(opts.cloudName)}/image/upload`;
  const res = await fetch(url, { method: 'POST', body: formData });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Cloudinary image upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message || text.slice(0, 200);
    throw new Error(msg);
  }
  const row = data as { secure_url?: string; public_id?: string; bytes?: number };
  if (!row.secure_url || !row.public_id) {
    throw new Error('Cloudinary image upload returned no URL');
  }
  return {
    secure_url: row.secure_url,
    public_id: row.public_id,
    bytes: row.bytes,
  };
}
