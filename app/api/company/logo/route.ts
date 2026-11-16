import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';
import {
  cloudinaryCloudName,
  cloudinaryUploadPresetName,
  uploadImageViaUnsignedPreset,
} from '@/lib/cloudinary-preset-upload';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROW_ID = 'default';
const LOGO_FOLDER = process.env.CLOUDINARY_COMPANY_LOGO_FOLDER?.trim() || 'company-logos';

function isImageFile(file: File): boolean {
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  const name = (file.name || '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg)$/.test(name);
}

type UploadResult = { secure_url: string; public_id: string };

function uploadImageSigned(buffer: Buffer, publicId: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: LOGO_FOLDER,
        public_id: publicId,
        resource_type: 'image',
        overwrite: true,
      },
      (error, res) => {
        if (error) reject(error);
        else if (res?.secure_url && res.public_id) {
          resolve({ secure_url: res.secure_url, public_id: res.public_id });
        } else reject(new Error('Cloudinary returned no image URL'));
      }
    );
    stream.end(buffer);
  });
}

async function uploadLogoToCloudinary(buffer: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
  const cloudName = cloudinaryCloudName();
  if (!cloudName) {
    throw new Error('Cloudinary cloud name is not configured on the server.');
  }

  const preset = cloudinaryUploadPresetName();
  if (preset) {
    try {
      return await uploadImageViaUnsignedPreset(buffer, {
        cloudName,
        uploadPreset: preset,
        folder: LOGO_FOLDER,
        filename,
        mimeType,
      });
    } catch (presetErr) {
      console.warn('[company/logo] preset upload failed, trying signed SDK:', presetErr);
    }
  }

  const apiKey =
    process.env.CLOUDINARY_API_KEY ||
    process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY ||
    process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY;
  const apiSecret =
    process.env.CLOUDINARY_API_SECRET ||
    process.env.EXPO_PUBLIC_CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary upload preset failed and signed upload is not configured. Set EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET or CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET.'
    );
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return uploadImageSigned(buffer, `company-logo-${Date.now()}`);
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  if (!isImageFile(file)) {
    return NextResponse.json({ error: 'Please upload a PNG, JPG, GIF, WebP, or SVG image.' }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Logo must be 5 MB or smaller.' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadLogoToCloudinary(buffer, file.name || 'logo.png', file.type || '');

    const { data, error } = await supabaseServer
      .from('company_settings')
      .upsert(
        {
          id: ROW_ID,
          logo_url: uploaded.secure_url,
          logo_public_id: uploaded.public_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select('logo_url, logo_public_id')
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: `Logo uploaded to Cloudinary but not saved: ${error.message}. Run migration create_company_settings.sql.`,
          logo_url: uploaded.secure_url,
          logo_public_id: uploaded.public_id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      logo_url: data?.logo_url ?? uploaded.secure_url,
      logo_public_id: data?.logo_public_id ?? uploaded.public_id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    console.error('[company/logo]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
