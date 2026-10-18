/** Normalises lift names so OSM ("Graukogel I") and Intermaps ("27 Graukogelbahn I") match. */
export function normaliseLiftName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^\d+[a-z]?\s+/, '')
    .replace(/bahn/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
