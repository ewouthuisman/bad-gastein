// Free-tier LLM access: Google Gemini first, an OpenRouter ":free" model as fallback.
import { setting } from './supabase.ts';
import { rankFlashModels } from './models.ts';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
let candidates: string[] | null = null;

/** Asks Google which models this key can use, best Flash first. */
async function discoverModels(key: string): Promise<string[]> {
  const res = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  if (!res.ok) throw new Error(`gemini models ${res.status}`);
  const data = await res.json();
  const names = (data?.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: { name: string }) => m.name.replace(/^models\//, ''));
  return rankFlashModels(names);
}

/** Tries each model in turn: a 429 (quota) or 404/5xx on one model must not take the chatbot down. */
async function gemini(messages: ChatMessage[], maxTokens: number): Promise<string> {
  const key = await setting('GEMINI_API_KEY');
  if (!key) throw new Error('no gemini key');
  const configured = await setting('GEMINI_MODEL');
  const models = [...(configured ? [configured] : []), ...(candidates ??= await discoverModels(key).catch(() => ['gemini-flash-latest', 'gemini-flash-lite-latest']))];
  const errors: string[] = [];
  for (const model of [...new Set(models)].slice(0, 6)) {
    const res = await geminiCall(key, model, messages, maxTokens);
    if (!res.ok) {
      errors.push(`${model} ${res.status} ${(await res.text()).slice(0, 160).replace(/\s+/g, ' ')}`);
      if (res.status === 404) candidates = null;
      continue;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (text.trim()) return text.trim();
    errors.push(`${model} empty`);
  }
  throw new Error(`gemini: ${errors.join(' | ')}`);
}

function geminiCall(key: string, model: string, messages: ChatMessage[], maxTokens: number): Promise<Response> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  return fetch(`${GEMINI}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.9 },
    }),
  });
}

async function openRouter(messages: ChatMessage[], maxTokens: number): Promise<string> {
  const key = await setting('OPENROUTER_API_KEY');
  if (!key) throw new Error('no openrouter key');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: (await setting('OPENROUTER_MODEL')) ?? 'openrouter/free', messages, max_tokens: maxTokens }),
  });
  if (!res.ok) throw new Error(`openrouter ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new Error('openrouter empty');
  return text.trim();
}

export async function complete(messages: ChatMessage[], opts: { maxTokens?: number } = {}): Promise<string> {
  const maxTokens = opts.maxTokens ?? 600;
  try {
    return await gemini(messages, maxTokens);
  } catch (e) {
    console.warn('gemini failed, trying openrouter:', (e as Error).message);
    return await openRouter(messages, maxTokens);
  }
}
