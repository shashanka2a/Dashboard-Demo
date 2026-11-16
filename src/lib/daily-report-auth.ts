import { resolveBearerUser } from '@/lib/auth-request';
import { isClientAppRole } from '@/lib/client-auth-shared';
import { resolveClientSession } from '@/lib/client-session';
import { supabaseServer } from '@/lib/supabase-server';

export type DailyReportAccessResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

function normProjectName(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Daily report HTML/PDF: signed-in user required.
 * - Client portal users: project must be in `client_project_access`.
 * - Employees: if `assigned_projects` is non-empty, project name must be listed.
 */
export async function checkDailyReportAccess(
  request: Request,
  projectId: string,
  projectName: string
): Promise<DailyReportAccessResult> {
  const auth = await resolveBearerUser(request);
  if (!auth.ok) {
    return { ok: false, error: auth.error, status: auth.status };
  }

  const user = auth.user;

  if (isClientAppRole(user)) {
    const session = await resolveClientSession(request);
    if (!session.ok) {
      return { ok: false, error: session.error, status: session.status };
    }
    const allowed = session.session.projects.some((p) => p.id === projectId);
    if (!allowed) {
      return { ok: false, error: 'You do not have access to this project.', status: 403 };
    }
    return { ok: true };
  }

  const email = user.email?.trim();
  if (!email) {
    return { ok: false, error: 'Account has no email.', status: 403 };
  }

  const { data: emp } = await supabaseServer
    .from('employees')
    .select('assigned_projects')
    .ilike('email', email)
    .maybeSingle();

  const assigned = (emp as { assigned_projects?: string[] | null } | null)?.assigned_projects;
  if (Array.isArray(assigned) && assigned.length > 0) {
    const target = normProjectName(projectName);
    const ok = assigned.some((p) => normProjectName(String(p)) === target);
    if (!ok) {
      return { ok: false, error: 'You are not assigned to this project.', status: 403 };
    }
  }

  return { ok: true };
}

/** Forward caller Bearer token when the PDF handler fetches report HTML internally. */
export function dailyReportAuthHeadersFromRequest(request: Request): Record<string, string> {
  const auth = request.headers.get('authorization')?.trim();
  return auth ? { Authorization: auth } : {};
}
