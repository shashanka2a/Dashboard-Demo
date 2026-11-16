import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const ROW_ID = 'default';

const DEFAULTS = {
  company_name: "Wick'd Environmental Technologies",
  company_phone: '+1 (904) 796-7790',
  company_email: 'brad@wickd-fl.com',
  cc_emails: 'savannah@wickd-fl.com',
  industry: 'Construction',
  sub_industry: 'Environmental Services',
  employee_range: '10-50',
  search_address: '',
  street_address: '864 Southwest Spirit Avenue',
  city: 'Fort White',
  state: 'Florida',
  zip_code: '32038',
  country: 'United States',
  report_language: 'English',
  brand_color: '#FF6633',
  logo_url: null as string | null,
  logo_public_id: null as string | null,
};

function rowToPayload(row: Record<string, unknown> | null) {
  if (!row) return { ...DEFAULTS };
  return {
    company_name: (row.company_name as string) ?? DEFAULTS.company_name,
    company_phone: (row.company_phone as string) ?? DEFAULTS.company_phone,
    company_email: (row.company_email as string) ?? DEFAULTS.company_email,
    cc_emails: (row.cc_emails as string) ?? DEFAULTS.cc_emails,
    industry: (row.industry as string) ?? DEFAULTS.industry,
    sub_industry: (row.sub_industry as string) ?? DEFAULTS.sub_industry,
    employee_range: (row.employee_range as string) ?? DEFAULTS.employee_range,
    search_address: (row.search_address as string) ?? DEFAULTS.search_address,
    street_address: (row.street_address as string) ?? DEFAULTS.street_address,
    city: (row.city as string) ?? DEFAULTS.city,
    state: (row.state as string) ?? DEFAULTS.state,
    zip_code: (row.zip_code as string) ?? DEFAULTS.zip_code,
    country: (row.country as string) ?? DEFAULTS.country,
    report_language: (row.report_language as string) ?? DEFAULTS.report_language,
    brand_color: (row.brand_color as string) ?? DEFAULTS.brand_color,
    logo_url: (row.logo_url as string | null) ?? null,
    logo_public_id: (row.logo_public_id as string | null) ?? null,
  };
}

export async function GET() {
  const { data, error } = await supabaseServer
    .from('company_settings')
    .select('*')
    .eq('id', ROW_ID)
    .maybeSingle();

  if (error) {
    if (/company_settings/i.test(error.message) && /does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json(DEFAULTS);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(rowToPayload((data as Record<string, unknown>) || null));
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fields = [
    'company_name',
    'company_phone',
    'company_email',
    'cc_emails',
    'industry',
    'sub_industry',
    'employee_range',
    'search_address',
    'street_address',
    'city',
    'state',
    'zip_code',
    'country',
    'report_language',
    'brand_color',
    'logo_url',
    'logo_public_id',
  ] as const;

  for (const key of fields) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  const { data, error } = await supabaseServer
    .from('company_settings')
    .upsert({ id: ROW_ID, ...patch }, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(rowToPayload(data as Record<string, unknown>));
}
