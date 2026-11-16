/**
 * In-memory Mock Supabase Engine for Demo Mode.
 * Seamlessly handles Supabase queries, inserts, updates, and auth administration
 * without requiring live credentials or external databases.
 */

import { demoStore, type DemoProject, type DemoEmployee, type DemoClient, type DemoIncident } from './demo-data';

function matchesFilter(row: Record<string, unknown>, col: string, val: unknown): boolean {
  if (row == null) return false;
  const rowVal = row[col];
  if (rowVal === val) return true;
  if (typeof rowVal === 'string' && typeof val === 'string') {
    return rowVal.toLowerCase() === val.toLowerCase();
  }
  return false;
}

export class MockQueryBuilder {
  private table: string;
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private orderCol?: string;
  private orderAsc = true;
  private limitCount?: number;
  private offsetCount?: number;
  private isSingle = false;
  private isMaybeSingle = false;
  private pendingInsert?: Record<string, unknown> | Array<Record<string, unknown>>;
  private pendingUpdate?: Record<string, unknown>;
  private pendingDelete = false;

  constructor(table: string) {
    this.table = table;
  }

  select(_columns = '*', _options?: Record<string, unknown>) {
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.offsetCount = from;
    this.limitCount = to - from + 1;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => matchesFilter(row, column, value));
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => !matchesFilter(row, column, value));
    return this;
  }

  in(column: string, values: unknown[]) {
    const set = new Set(values.map((v) => String(v).toLowerCase()));
    this.filters.push((row) => {
      const val = row[column];
      return set.has(String(val).toLowerCase());
    });
    return this;
  }

  ilike(column: string, pattern: string) {
    const cleanPattern = pattern.replace(/%/g, '').toLowerCase();
    this.filters.push((row) => {
      const val = String(row[column] || '').toLowerCase();
      return val.includes(cleanPattern);
    });
    return this;
  }

  or(filterStr: string) {
    // Basic support for OR clauses like "status.eq.open,status.eq.under_investigation"
    if (filterStr.includes('report_date')) {
      return this;
    }
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(values: Record<string, unknown> | Array<Record<string, unknown>>) {
    this.pendingInsert = values;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.pendingUpdate = values;
    return this;
  }

  delete() {
    this.pendingDelete = true;
    return this;
  }

  private getTableData(): Array<Record<string, unknown>> {
    switch (this.table) {
      case 'projects':
        return demoStore.projects as unknown as Array<Record<string, unknown>>;
      case 'employees':
        return demoStore.employees as unknown as Array<Record<string, unknown>>;
      case 'clients':
        return demoStore.clients as unknown as Array<Record<string, unknown>>;
      case 'activities':
      case 'activities_view':
        return demoStore.activities.map((a) => ({
          id: a.id,
          employee_name: a.employeeName,
          action: a.action,
          project_name: a.project,
          activity_type: a.activityType,
          timestamp_label: a.timestamp,
          created_at: a.isoTimestamp,
          updated_at: a.isoTimestamp,
          report_date_ymd: a.reportDateYmd,
          metrics: a.metrics,
          photos: a.photos,
        }));
      case 'incidents':
        return demoStore.incidents as unknown as Array<Record<string, unknown>>;
      case 'reports':
      case 'daily_signed_reports':
        return demoStore.reports.map((r) => ({
          id: r.id,
          project_name: r.projectName,
          project_id: r.projectId,
          date: r.date,
          report_date: r.date,
          created_at: new Date().toISOString(),
          signed_at: r.reportSigned ? new Date().toISOString() : null,
          signature_png: r.reportSigned ? 'data:image/png;base64,demo-signature' : null,
          weather: r.weather,
          photos: r.photos,
          delays: r.delays,
        }));
      case 'company_settings':
        return [demoStore.companySettings as unknown as Record<string, unknown>];
      case 'metric_fields':
        return [
          { id: 'mf-1', name: 'Acres Treated', unit: 'acres', field_type: 'number' },
          { id: 'mf-2', name: 'Machine Hours', unit: 'hrs', field_type: 'number' },
          { id: 'mf-3', name: 'Diesel Gallons', unit: 'gal', field_type: 'number' },
          { id: 'mf-4', name: 'Linear Feet', unit: 'ft', field_type: 'number' },
        ];
      case 'chemical_presets':
        return [
          { id: 'cp-1', name: 'Garlon 4 Ultra', epa_reg: '62719-527', active_ingredient: 'Triclopyr 60.45%' },
          { id: 'cp-2', name: 'Milestone Herbicide', epa_reg: '62719-519', active_ingredient: 'Aminopyralid 40.6%' },
          { id: 'cp-3', name: 'Rodeo Aquatic', epa_reg: '62719-324', active_ingredient: 'Glyphosate 53.8%' },
        ];
      case 'photo_tags':
        return [
          { id: 'pt-1', tag: 'Pre-Work' },
          { id: 'pt-2', tag: 'Post-Work' },
          { id: 'pt-3', tag: 'Equipment' },
          { id: 'pt-4', tag: 'Safety Briefing' },
          { id: 'pt-5', tag: 'Environmental Hazard' },
        ];
      default:
        return [];
    }
  }

  private execute() {
    // 1. Handle INSERT
    if (this.pendingInsert) {
      const items = Array.isArray(this.pendingInsert) ? this.pendingInsert : [this.pendingInsert];
      const createdItems: Array<Record<string, unknown>> = [];

      for (const item of items) {
        if (this.table === 'projects') {
          const p = demoStore.addProject(item as unknown as Partial<DemoProject>);
          createdItems.push(p as unknown as Record<string, unknown>);
        } else if (this.table === 'employees') {
          const e = demoStore.addEmployee(item as unknown as Partial<DemoEmployee>);
          createdItems.push(e as unknown as Record<string, unknown>);
        } else if (this.table === 'clients') {
          const c = demoStore.addClient(item as unknown as Partial<DemoClient>);
          createdItems.push(c as unknown as Record<string, unknown>);
        } else {
          createdItems.push({ id: `mock-${Date.now()}`, ...item });
        }
      }

      const resData = this.isSingle ? createdItems[0] : createdItems;
      return { data: resData, error: null, count: createdItems.length };
    }

    // 2. Handle UPDATE
    if (this.pendingUpdate) {
      if (this.table === 'company_settings') {
        demoStore.companySettings = { ...demoStore.companySettings, ...this.pendingUpdate };
        return { data: demoStore.companySettings, error: null };
      }
      if (this.table === 'incidents') {
        const item = demoStore.incidents.find((i) => this.filters.every((f) => f(i as unknown as Record<string, unknown>)));
        if (item) {
          demoStore.updateIncident(item.id, this.pendingUpdate as Partial<DemoIncident>);
          return { data: item, error: null };
        }
      }
      if (this.table === 'projects') {
        const item = demoStore.projects.find((p) => this.filters.every((f) => f(p as unknown as Record<string, unknown>)));
        if (item) {
          demoStore.updateProject(item.id, this.pendingUpdate as Partial<DemoProject>);
          return { data: item, error: null };
        }
      }
      return { data: this.pendingUpdate, error: null };
    }

    // 3. Handle DELETE
    if (this.pendingDelete) {
      return { data: null, error: null };
    }

    // 4. Handle SELECT
    let rows = [...this.getTableData()];

    // Apply filters
    for (const filter of this.filters) {
      rows = rows.filter(filter);
    }

    // Apply order
    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.orderAsc;
      rows.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA == null && valB == null) return 0;
        if (valA == null) return asc ? -1 : 1;
        if (valB == null) return asc ? 1 : -1;
        if (typeof valA === 'string' && typeof valB === 'string') {
          return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (Number(valA) < Number(valB)) return asc ? -1 : 1;
        if (Number(valA) > Number(valB)) return asc ? 1 : -1;
        return 0;
      });
    }

    // Apply offset & limit
    if (this.offsetCount) {
      rows = rows.slice(this.offsetCount);
    }
    if (this.limitCount !== undefined) {
      rows = rows.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      return { data: rows[0] || null, error: rows.length ? null : { message: 'Row not found' }, count: rows.length ? 1 : 0 };
    }

    if (this.isMaybeSingle) {
      return { data: rows[0] || null, error: null, count: rows.length ? 1 : 0 };
    }

    return { data: rows, error: null, count: rows.length };
  }

  // Promise-like interface
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const result = this.execute();
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

export function createMockSupabaseServer() {
  return {
    from: (table: string) => new MockQueryBuilder(table),
    auth: {
      admin: {
        generateLink: async ({ options, email }: { options: { redirectTo?: string }; email: string }) => {
          const redirectTo = options?.redirectTo || '/auth/callback';
          return {
            data: {
              properties: {
                action_link: `${redirectTo}?code=demo-invite-token&email=${encodeURIComponent(email)}`,
              },
            },
            error: null,
          };
        },
        listUsers: async () => {
          return {
            data: {
              users: demoStore.employees.map((e) => ({
                id: e.id,
                email: e.email,
                user_metadata: { full_name: e.name, app_role: e.role },
              })),
            },
            error: null,
          };
        },
        updateUserById: async (userId: string, meta: unknown) => {
          const userMeta = (meta && typeof meta === 'object') ? (meta as Record<string, unknown>) : {};
          return { data: { user: { id: userId, ...userMeta } }, error: null };
        },
      },
      getSession: async () => {
        return {
          data: {
            session: {
              user: {
                id: 'demo-admin-001',
                email: 'admin@utilityvision.demo',
                user_metadata: { app_role: 'account_admin', full_name: 'Brad Wickstrom' },
              },
            },
          },
          error: null,
        };
      },
      signOut: async () => ({ error: null }),
    },
  };
}
