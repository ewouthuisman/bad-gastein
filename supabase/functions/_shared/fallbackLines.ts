// Commentary used when the LLM is unavailable. Keyed by Soipen mode.

export const FALLBACK_LINES: Record<'ski' | 'lunch' | 'apres' | 'overgave', string[]> = {
  ski: [
    'Iedereen is nog verdacht nuchter. Er wordt zelfs geskied.',
    'Skiambities: hoog. Dorst: onder controle. Voorlopig.',
    'De pistes lonken, de bar nog niet. Geniet ervan zolang het duurt.',
  ],
  lunch: [
    'De lunch duurt opvallend lang. Er wordt "nog eentje" gezegd.',
    'Eerste Radler gesignaleerd. Dit is hoe het altijd begint.',
    'Skiambities dalen. De behoefte aan Kaiserschmarrn en bier stijgt.',
  ],
  apres: [
    'Skiambities dalen. De behoefte aan drank stijgt.',
    'Skischoenen nog aan, maar de ski\'s zijn vergeten. Après-ski modus actief.',
    'Het aantal keer "Hey Baby" is statistisch onverantwoord.',
  ],
  overgave: [
    'Totale overgave. Morgen vroeg skiën is officieel een theoretisch concept.',
    'De groep heeft de berg opgegeven. De berg heeft de groep opgegeven.',
    'Soipie adviseert water. Soipie wordt genegeerd.',
  ],
};

export function fallbackLine(mode: keyof typeof FALLBACK_LINES, seed = Date.now()): string {
  const lines = FALLBACK_LINES[mode];
  return lines[Math.floor(seed / 600_000) % lines.length];
}
