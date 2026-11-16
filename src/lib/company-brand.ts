import fs from 'fs';
import path from 'path';
import { supabaseServer } from '@/lib/supabase-server';

let staticLogoDataUri: string | undefined;

function getStaticReportLogoDataUri(): string {
  if (staticLogoDataUri !== undefined) return staticLogoDataUri;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'icon.png');
    const buf = fs.readFileSync(logoPath);
    staticLogoDataUri = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    staticLogoDataUri = '';
  }
  return staticLogoDataUri;
}

/** Company logo for daily reports: DB URL first, else bundled `public/icon.png` as data URI. */
export async function getCompanyBrandLogoForReport(): Promise<{
  src: string;
  alt: string;
}> {
  const { data, error } = await supabaseServer
    .from('company_settings')
    .select('logo_url, company_name')
    .eq('id', 'default')
    .maybeSingle();

  if (!error && data?.logo_url) {
    const url = String(data.logo_url).trim();
    if (url) {
      return {
        src: url,
        alt: String(data.company_name || "WICK'D Environmental Technologies").trim(),
      };
    }
  }

  const fallback = getStaticReportLogoDataUri();
  return {
    src: fallback,
    alt: "WICK'D Environmental Technologies",
  };
}
