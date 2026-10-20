// Google retires Gemini model ids regularly; pick the newest stable Flash model the key can use.

const EXCLUDE = /lite|image|tts|audio|live|preview|exp|thinking|embedding/i;

const version = (name: string) => Number(name.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);

export function chooseFlashModel(names: string[]): string {
  const flash = names.filter((n) => /flash/i.test(n) && !EXCLUDE.test(n)).sort((a, b) => version(b) - version(a));
  return flash[0] ?? 'gemini-flash-latest';
}

/** Every usable Flash model, best first (stable before lite). Each model has its own free-tier quota, so this is also the order to fall back in. */
export function rankFlashModels(names: string[]): string[] {
  const usable = names.filter((n) => /flash/i.test(n) && !/image|tts|audio|live|preview|exp|thinking|embedding/i.test(n));
  const rank = (n: string) => version(n) * 10 - (/lite/i.test(n) ? 5 : 0);
  const sorted = usable.sort((a, b) => rank(b) - rank(a));
  return [...new Set([...sorted, 'gemini-flash-latest', 'gemini-flash-lite-latest'])];
}
