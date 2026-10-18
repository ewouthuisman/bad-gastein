// Free-tier LLM access: Google Gemini first, an OpenRouter ":free" model as fallback.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function gemini(messages: ChatMessage[], maxTokens: number): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('no gemini key');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
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
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text.trim()) throw new Error('gemini empty');
  return text.trim();
}

async function openRouter(messages: ChatMessage[], maxTokens: number): Promise<string> {
  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) throw new Error('no openrouter key');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: Deno.env.get('OPENROUTER_MODEL') ?? 'openrouter/free', messages, max_tokens: maxTokens }),
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
