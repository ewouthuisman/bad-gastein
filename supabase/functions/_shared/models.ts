// Google retires Gemini model ids regularly; pick the newest stable Flash model the key can use.

const EXCLUDE = /lite|image|tts|audio|live|preview|exp|thinking|embedding/i;

const version = (name: string) => Number(name.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);

export function chooseFlashModel(names: string[]): string {
  const flash = names.filter((n) => /flash/i.test(n) && !EXCLUDE.test(n)).sort((a, b) => version(b) - version(a));
  return flash[0] ?? 'gemini-flash-latest';
}
