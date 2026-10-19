export type AreaKey = 'stubnerkogel' | 'graukogel' | 'gibfelbahn' | 'goldbergbahn';

export const AREAS: { key: AreaKey; label: string; anchorLift: string }[] = [
  { key: 'stubnerkogel', label: 'Stubnerkogel (Bad Gastein)', anchorLift: 'Stubnerkogelbahn I' },
  { key: 'graukogel', label: 'Graukogel (Bad Gastein)', anchorLift: 'Graukogel I' },
  { key: 'gibfelbahn', label: 'Gibfelbahn (Dorfgastein)', anchorLift: 'Gipfelbahn Fulseck I' },
  { key: 'goldbergbahn', label: 'Goldbergbahn (Sportgastein)', anchorLift: 'Goldbergbahn I' },
];

export const AREA_LABEL = Object.fromEntries(AREAS.map((a) => [a.key, a.label])) as Record<AreaKey, string>;

export const isAreaKey = (v: string | null | undefined): v is AreaKey => AREAS.some((a) => a.key === v);
