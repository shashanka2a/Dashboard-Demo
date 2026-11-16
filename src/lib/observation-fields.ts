/** Site-condition observation constants (shared by mobile + dashboard). */

export const OBSERVATION_TYPES = ['Invasive Vegetation', 'Hazards on Site'] as const;
export type ObservationType = (typeof OBSERVATION_TYPES)[number];

export const OBSERVATION_STATUSES = ['Open', 'Resolved'] as const;
export type ObservationLifecycleStatus = (typeof OBSERVATION_STATUSES)[number];

export const OBSERVATION_PROGRESS_OPTIONS = [
  'Unchanged',
  'Worsening',
  'New Occurrence',
  'Recurrent',
  'Improved',
] as const;
export type ObservationProgress = (typeof OBSERVATION_PROGRESS_OPTIONS)[number];

/** Grouped select-all description tags (titles shown in reports / dashboard). */
export const OBSERVATION_DESCRIPTION_TAG_GROUPS: { title: string; tags: readonly string[] }[] = [
  {
    title: 'Scale & Density',
    tags: ['Minimal', 'Scattered', 'Patchy', 'Localized', 'Widespread', 'Dense'],
  },
  {
    title: 'Physical Traits',
    tags: ['Small', 'Moderate', 'Large', 'Shallow', 'Deep', 'Tall', 'Thick', 'Short'],
  },
  {
    title: 'Behavior & Threat',
    tags: ['Encroaching', 'Burrowing', 'Nesting', 'Aggressive', 'Dangerous', 'Caused Damage'],
  },
  {
    title: 'Visibility & Access',
    tags: ['Exposed', 'Hidden', 'Low Visibility', 'Obstructed', 'Impeding Operations'],
  },
];

export const OBSERVATION_DESCRIPTION_TAGS = OBSERVATION_DESCRIPTION_TAG_GROUPS.flatMap((g) => [
  ...g.tags,
]) as readonly string[];
export type ObservationDescriptionTag = (typeof OBSERVATION_DESCRIPTION_TAGS)[number];

/** Format selected tags with group titles for description display / storage. */
export function formatObservationDescriptionTags(
  selected: string[] | null | undefined,
  options?: { multiline?: boolean }
): string {
  const set = new Set((selected ?? []).map((t) => String(t).trim()).filter(Boolean));
  if (set.size === 0) return '';

  const lines: string[] = [];
  const used = new Set<string>();

  for (const group of OBSERVATION_DESCRIPTION_TAG_GROUPS) {
    const matched = group.tags.filter((t) => set.has(t));
    if (matched.length === 0) continue;
    matched.forEach((t) => used.add(t));
    lines.push(`${group.title}: ${matched.join(', ')}`);
  }

  const leftover = [...set].filter((t) => !used.has(t));
  if (leftover.length > 0) {
    lines.push(`Other: ${leftover.join(', ')}`);
  }

  return options?.multiline === false ? lines.join(' · ') : lines.join('\n');
}

/** Prefer stored description; otherwise build from tags with group titles. */
export function resolveObservationDescription(row: {
  description?: string | null;
  description_tags?: string[] | null;
}): string {
  const stored = String(row.description ?? '').trim();
  if (stored) return stored;
  return formatObservationDescriptionTags(row.description_tags ?? []);
}
