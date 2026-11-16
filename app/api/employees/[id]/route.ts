import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// PUT /api/employees/[id]
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await request.json();
  const {
    name, role, status, assigned_projects,
    email, phone, employee_id, classification,
  } = body;

  const { data, error } = await supabaseServer
    .from('employees')
    .update({ name, role, status, assigned_projects, email, phone, employee_id, classification })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/employees/[id]
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const { data: employeeRow, error: loadErr } = await supabaseServer
    .from('employees')
    .select('id, email')
    .eq('id', id)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!employeeRow) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

  // Remove Supabase Auth user for this employee (if present).
  // Employees do not currently store auth_user_id; delete by matching email.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    const email = employeeRow.email ? String(employeeRow.email).trim().toLowerCase() : '';
    if (email) {
      try {
        const { data, error } = await supabaseServer.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (!error) {
          const hit = data?.users?.find((u) => (u.email || '').toLowerCase() === email);
          if (hit?.id) {
            await supabaseServer.auth.admin.deleteUser(hit.id);
          }
        }
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Could not delete Supabase auth user.' },
          { status: 500 }
        );
      }
    }
  }

  const { error } = await supabaseServer.from('employees').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
