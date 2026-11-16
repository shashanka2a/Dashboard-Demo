import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { deliverClientLoginInvite } from '@/lib/client-invite';

// POST /api/clients/[id]/invite — email client portal login invite
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const { data: client, error: clientErr } = await supabaseServer
    .from('clients')
    .select('id, name, email, status')
    .eq('id', id)
    .single();

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
  }

  if (client.status !== 'active') {
    return NextResponse.json({ error: 'Client must be active to receive an invite.' }, { status: 400 });
  }

  const result = await deliverClientLoginInvite(client);

  if (!result.ok) {
    const msg = result.error;
    const lower = msg.toLowerCase();
    const status =
      lower.includes('not configured') ||
      lower.includes('must point') ||
      lower.includes('required on the server')
        ? 503
        : lower.includes('email')
          ? 400
          : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({ ok: true, flow: result.flow });
}
