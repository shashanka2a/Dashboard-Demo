/** Test/staging projects hidden from the global main dashboard (not per-project views). */
export const MAIN_DASHBOARD_EXCLUDED_PROJECTS = [
  'ARTIFACT SOLAR SITE',
  'ARTIFACT SOLAR SITE- TESTING',
] as const;

/** @deprecated Use MAIN_DASHBOARD_EXCLUDED_PROJECTS */
export const MAIN_ACTIVITY_EXCLUDED_PROJECTS = MAIN_DASHBOARD_EXCLUDED_PROJECTS;

function normProjectName(name: string): string {
  return name.trim().replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').toLowerCase();
}

export function isExcludedFromMainDashboard(projectName: string): boolean {
  const n = normProjectName(projectName);
  return MAIN_DASHBOARD_EXCLUDED_PROJECTS.some((p) => normProjectName(p) === n);
}

/** @deprecated Use isExcludedFromMainDashboard */
export const isExcludedFromMainActivity = isExcludedFromMainDashboard;

export function filterByMainDashboardProject<T>(
  items: T[],
  getProjectName: (item: T) => string | null | undefined
): T[] {
  return items.filter((item) => {
    const name = getProjectName(item);
    if (!name?.trim()) return true;
    return !isExcludedFromMainDashboard(name);
  });
}

export function filterProjectNamesForMainDashboard(names: string[]): string[] {
  return names.filter((n) => !isExcludedFromMainDashboard(n));
}

/** @deprecated Use filterProjectNamesForMainDashboard */
export const filterProjectNamesForMainActivity = filterProjectNamesForMainDashboard;

export function filterActivitiesForMainDashboard<T extends { project: string }>(items: T[]): T[] {
  return filterByMainDashboardProject(items, (a) => a.project);
}

/** @deprecated Use filterActivitiesForMainDashboard */
export const filterActivitiesForMainActivity = filterActivitiesForMainDashboard;

export function filterReportsForMainDashboard<T extends { projectName: string }>(items: T[]): T[] {
  return filterByMainDashboardProject(items, (r) => r.projectName);
}

export function filterRowsByProjectNameForMainDashboard<
  T extends { project_name?: string | null },
>(items: T[]): T[] {
  return filterByMainDashboardProject(items, (r) => r.project_name);
}
