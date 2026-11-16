import { NextResponse } from 'next/server';
import { deleteAuthenticatedAccount } from '@/lib/account-deletion';
import { resolveBearerUser, verifyUserPassword } from '@/lib/auth-request';

export const dynamic = 'force-dynamic';

type DeleteBody = {
  password?: string;
  confirm?: string;
};

// POST /api/account/delete — permanently delete the signed-in user's account
export async function POST(request: Request) {
  const resolved = await resolveBearerUser(request);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const user = resolved.user;
  const email = user.email?.trim();
  if (!email) {
    return NextResponse.json({ error: 'This account has no email address on file.' }, { status: 400 });
  }

  let body: DeleteBody = {};
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const password = String(body.password || '');
  const confirm = String(body.confirm || '').trim();

  if (!password) {
    return NextResponse.json({ error: 'Enter your password to confirm deletion.' }, { status: 400 });
  }

  if (confirm !== 'DELETE') {
    return NextResponse.json({ error: 'Type DELETE in the confirmation field.' }, { status: 400 });
  }

  const passwordOk = await verifyUserPassword(email, password);
  if (!passwordOk) {
    return NextResponse.json({ error: 'Password is incorrect.' }, { status: 403 });
  }

  const result = await deleteAuthenticatedAccount(user);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    accountType: result.accountType,
    message: 'Your account has been deleted.',
  });
}
