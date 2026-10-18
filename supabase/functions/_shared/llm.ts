// Free-tier LLM access: Google Gemini first, an OpenRouter ":free" model as fallback.
import { setting } from './supabase.ts';
import { chooseFlashModel } from './models.ts';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
let resolvedModel: string | null = null;

/** Asks Google which models this key can use and picks the newest stable Flash. */
async function discoverModel(key: string): Promise<string> {
  const res = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  if (!res.ok) throw new Error(`gemini models ${res.status}`);
  const data = await res.json();
  const names = (data?.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: { name: string }) => m.name.replace(/^models\//, ''));
  return chooseFlashModel(names);
}

async function gemini(messages: ChatMessage[], maxTokens: number): Promise<string> {
  const key = await setting('GEMINI_API_KEY');
  if (!key) throw new Error('no gemini key');
  const configured = await setting('GEMINI_MODEL');
  let res = await geminiCall(key, configured ?? resolvedModel ?? 'gemini-flash-latest', messages, maxTokens);
  if (res.status === 404 && !configured) {
    resolvedModel = await discoverModel(key);
    res = await geminiCall(key, resolvedModel, messages, maxTokens);
  }
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text.trim()) throw new Error('gemini empty');
  return text.trim();
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
