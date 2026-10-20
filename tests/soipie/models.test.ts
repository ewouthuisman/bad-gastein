import { describe, expect, it } from 'vitest';
import { chooseFlashModel, rankFlashModels } from '../../supabase/functions/_shared/models.ts';

describe('chooseFlashModel', () => {
  it('picks the newest stable Flash model', () => {
    expect(chooseFlashModel(['gemini-2.0-flash', 'gemini-3.0-flash', 'gemini-3.0-pro', 'gemini-2.5-flash-lite'])).toBe('gemini-3.0-flash');
  });
  it('skips lite, image, audio and preview variants', () => {
    expect(chooseFlashModel(['gemini-3.1-flash-lite', 'gemini-3.1-flash-image', 'gemini-3.1-flash-preview-09', 'gemini-3.0-flash-001'])).toBe('gemini-3.0-flash-001');
  });
  it('falls back to the flash alias when nothing matches', () => {
    expect(chooseFlashModel(['gemini-3.0-pro'])).toBe('gemini-flash-latest');
  });
});

describe('rankFlashModels', () => {
  it('ranks newest stable first, lite after, and always ends with the aliases', () => {
    const r = rankFlashModels(['gemini-2.5-flash-lite', 'gemini-3.0-flash', 'gemini-2.5-flash', 'gemini-3.0-pro', 'gemini-3.0-flash-image']);
    expect(r).toEqual(['gemini-3.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest']);
  });
});
