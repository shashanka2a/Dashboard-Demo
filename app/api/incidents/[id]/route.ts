import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import {
  incidentEmployeeInfoIncomplete,
  normalizeInjuredEmployeeInfoForSave,
  parseInjuredEmployeeInfo,
} from '@/lib/incident-employee-info';

type PatchBody = {
  injured_employee_info?: unknown;
};

// PATCH /api/incidents/[id] — update injured employee info (complete unknown DOB / hire dates)
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!('injured_employee_info' in body)) {
    return NextResponse.json({ error: 'injured_employee_info is required' }, { status: 400 });
  }

  const injured_employee_info = normalizeInjuredEmployeeInfoForSave(body.injured_employee_info);

  const { data, error } = await supabaseServer
    .from('incidents')
    .update({ injured_employee_info })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (/No rows|0 rows/i.test(error.message)) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ...data,
    injured_employee_info: parseInjuredEmployeeInfo(data.injured_employee_info),
    employee_info_incomplete: incidentEmployeeInfoIncomplete(data.injured_employee_info),
  });
}
