import { useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export interface HouseSection {
  section: string;
  title: string;
  markdown: string;
  sort: number;
}

const ADDRESS = 'Kötschachtaler Straße 5, 5640 Bad Gastein, Oostenrijk';
const ROUTE_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ADDRESS)}`;

function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false, breaks: true }) as string;
  return DOMPurify.sanitize(html).replaceAll('[PLACEHOLDER]', '<span class="placeholder">[PLACEHOLDER]</span>');
}

function bookingUrl(md: string): string | null {
  return md.match(/https?:\/\/[^\s)]*booking\.com[^\s)]*/i)?.[0] ?? null;
}

function Section({ s, isAdmin, onSave }: { s: HouseSection; isAdmin: boolean; onSave: (section: string, markdown: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.markdown);
  const [saving, setSaving] = useState(false);
  const booking = s.section === 'booking' ? bookingUrl(s.markdown) : null;

  async function save() {
    setSaving(true);
    await onSave(s.section, draft);
    setSaving(false);
    setEditing(false);
  }

  return (
    <section className="card" aria-label={s.title}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{s.title}</h2>
        {isAdmin && !editing && (
          <button type="button" className="btn small" onClick={() => { setDraft(s.markdown); setEditing(true); }}>Bewerken</button>
        )}
      </div>
      {editing ? (
        <>
          <textarea className="md-editor" value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} />
          <div className="row">
            <button type="button" className="btn primary" onClick={() => void save()} disabled={saving}>Opslaan</button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>Annuleren</button>
          </div>
        </>
      ) : (
        <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(s.markdown) }} />
      )}
      {s.section === 'algemeen' && <a className="btn small" href={ROUTE_URL} target="_blank" rel="noreferrer">Route naar het huis</a>}
      {booking && <a className="btn small primary" href={booking} target="_blank" rel="noreferrer">Open in Booking</a>}
    </section>
  );
}

export function HouseInfo({ sections, isAdmin, onSave }: { sections: HouseSection[]; isAdmin: boolean; onSave: (section: string, markdown: string) => Promise<void> }) {
  return (
    <div>
      {[...sections].sort((a, b) => a.sort - b.sort).map((s) => (
        <Section key={s.section} s={s} isAdmin={isAdmin} onSave={onSave} />
      ))}
    </div>
  );
}
