import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = ['Waar lunchen we morgen?', 'Welke liften zijn dicht?', 'Wie is het meest gesoipt?'];

/** Turns a failed function call into the Dutch message the function sent back. */
async function errorMessage(error: { message: string; context?: unknown }): Promise<string> {
  const ctx = error.context;
  if (ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as { error?: string };
      if (body.error) return body.error;
    } catch {
      /* fall through */
    }
  }
  return 'Soipie reageert niet. Probeer het zo nog eens.';
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setMessages(((data as Msg[]) ?? []).reverse()));
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [messages, pending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setPending(true);
    setError(null);
    setInput('');
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: 'user', content: message }]);
    const { data, error: err } = await supabase.functions.invoke('soipie', { body: { message } });
    setPending(false);
    if (err || !data?.reply) {
      setError(err ? await errorMessage(err) : 'Soipie zegt niks. Verdacht.');
      return;
    }
    setMessages((m) => [...m, { id: `reply-${Date.now()}`, role: 'assistant', content: data.reply as string }]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className="card chat">
      <h2 style={{ marginTop: 0 }}>Vraag het Soipie</h2>
      <div className="chat-log">
        {messages.length === 0 && <p className="muted">Soipie weet alles van de planning, het huis, de liften, het weer en wie er het meest gesoipt is.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>{m.content}</div>
        ))}
        {pending && <div className="bubble assistant muted">Soipie denkt na…</div>}
        <div ref={end} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chip" onClick={() => void send(s)} disabled={pending}>{s}</button>
        ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input aria-label="Bericht aan Soipie" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Vraag iets…" maxLength={1000} />
        <button type="submit" className="btn primary" disabled={pending || !input.trim()}>Verstuur</button>
      </form>
    </div>
  );
}
