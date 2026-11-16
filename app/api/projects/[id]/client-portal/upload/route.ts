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

const COVER_FOLDER = 'project-portal-covers';
const KMZ_BUCKET = 'project-portal-kmz';

function isImage(file: File): boolean {
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp)$/i.test(file.name || '');
}

function isKmz(file: File): boolean {
  const name = (file.name || '').toLowerCase();
  const t = (file.type || '').toLowerCase();
  return name.endsWith('.kmz') || name.endsWith('.kml') || t.includes('kml') || t.includes('kmz');
}

// POST /api/projects/[id]/client-portal/upload  multipart: file + kind=cover|kmz
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;

  const { data: project, error: projErr } = await supabaseServer
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .maybeSingle();

  if (projErr) return NextResponse.json({ error: projErr.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const form = await request.formData();
  const file = form.get('file');
  const kind = String(form.get('kind') || 'cover');

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name || (kind === 'kmz' ? 'boundary.kmz' : 'cover.jpg');

  try {
    if (kind === 'kmz') {
      if (!isKmz(file)) {
        return NextResponse.json({ error: 'Upload a .kmz or .kml file.' }, { status: 400 });
      }
      // Store KMZ/KML in Supabase Storage to avoid Cloudinary raw restrictions.
      // Ensure bucket `project-portal-kmz` exists (public recommended).
      const ext = (filename.split('.').pop() || 'kmz').toLowerCase();
      const objectPath = `${projectId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
      const contentType = file.type || (ext === 'kml' ? 'application/vnd.google-earth.kml+xml' : 'application/vnd.google-earth.kmz');

      const uploadRes = await supabaseServer.storage.from(KMZ_BUCKET).upload(objectPath, buffer, {
        contentType,
        upsert: true,
      });

      if (uploadRes.error) {
        return NextResponse.json(
          { error: `KMZ upload failed: ${uploadRes.error.message}. Create a Supabase Storage bucket named "${KMZ_BUCKET}" (public recommended).` },
          { status: 500 }
        );
      }

      const publicUrlRes = supabaseServer.storage.from(KMZ_BUCKET).getPublicUrl(objectPath);
      const publicUrl = publicUrlRes.data.publicUrl;

      const { error } = await supabaseServer
        .from('projects')
        .update({
          kmz_url: publicUrl,
          // reuse this column to store the storage object path for deletion
          kmz_public_id: objectPath,
          kmz_filename: filename,
          kmz_uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({
        kmz_url: publicUrl,
        kmz_filename: filename,
        kmz_uploaded_at: new Date().toISOString(),
      });
    }

    const cloudName = cloudinaryCloudName();
    const preset = cloudinaryUploadPresetName();
    if (!cloudName || !preset) {
      return NextResponse.json({ error: 'Cloudinary upload preset is not configured.' }, { status: 503 });
    }

    if (!isImage(file)) {
      return NextResponse.json({ error: 'Upload an image file (JPG, PNG, WebP).' }, { status: 400 });
    }

    const uploaded = await uploadImageViaUnsignedPreset(buffer, {
      cloudName,
      uploadPreset: preset,
      folder: `${COVER_FOLDER}/${projectId}`,
      filename,
      mimeType: file.type || 'image/jpeg',
    });

    const { error } = await supabaseServer
      .from('projects')
      .update({
        cover_photo_url: uploaded.secure_url,
        cover_photo_public_id: uploaded.public_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ cover_photo_url: uploaded.secure_url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/client-portal/upload?kind=cover|kmz
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;
  const kind = request.nextUrl.searchParams.get('kind') || 'cover';

  const { data: project } = await supabaseServer
    .from('projects')
    .select('cover_photo_public_id, kmz_public_id')
    .eq('id', projectId)
    .maybeSingle();

  if (kind === 'kmz') {
    const objectPath = project?.kmz_public_id ? String(project.kmz_public_id) : '';
    if (objectPath) {
      // best effort delete from bucket
      await supabaseServer.storage.from(KMZ_BUCKET).remove([objectPath]);
    }
    await supabaseServer
      .from('projects')
      .update({
        kmz_url: null,
        kmz_public_id: null,
        kmz_filename: null,
        kmz_uploaded_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);
    return NextResponse.json({ success: true });
  }

  const publicId = project?.cover_photo_public_id;
  if (publicId) {
    try {
      cloudinary.config({
        cloud_name: cloudinaryCloudName(),
        api_key: process.env.CLOUDINARY_API_KEY || process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET || process.env.EXPO_PUBLIC_CLOUDINARY_API_SECRET,
        secure: true,
      });
      await cloudinary.uploader.destroy(String(publicId), { resource_type: 'image' });
    } catch {
      /* best effort */
    }
  }

  await supabaseServer
    .from('projects')
    .update({
      cover_photo_url: null,
      cover_photo_public_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  return NextResponse.json({ success: true });
}
