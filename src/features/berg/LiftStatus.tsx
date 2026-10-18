import { formatAgo } from '../location/freshness';

export interface LiftStatusRow {
  id: string;
  name: string;
  kind: 'lift' | 'piste';
  is_open: boolean;
  updated_at: string;
}

export const OFFICIAL_STATUS_URL = 'https://www.skigastein.com/en/info-daily/';
const STALE_MS = 60 * 60_000;

export function LiftStatus({ items, now }: { items: LiftStatusRow[]; now: Date }) {
  if (!items.length) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Liften & pistes</h2>
        <p className="muted">Liftstatus onbekend — bekijk de officiële status.</p>
        <a className="btn small" href={OFFICIAL_STATUS_URL} target="_blank" rel="noreferrer">Officiële status</a>
      </div>
    );
  }
  const updated = new Date(items.map((i) => i.updated_at).sort().at(-1)!);
  const sorted = [...items].sort((a, b) => Number(a.is_open) - Number(b.is_open) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'nl'));
  const stale = now.getTime() - updated.getTime() > STALE_MS;
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Liften & pistes</h2>
      <p className="muted">
        Bijgewerkt {formatAgo(updated, now)}{stale ? ' — verouderd, check de officiële status' : ''} ·{' '}
        <a href={OFFICIAL_STATUS_URL} target="_blank" rel="noreferrer">Officiële status</a>
      </p>
      <ul className="status-grid">
        {sorted.map((i) => (
          <li key={i.id} className={`chip ${i.is_open ? 'open' : 'closed'}`}>
            {i.kind === 'lift' ? '🚡' : '⛷️'} {i.name} {i.is_open ? '' : '· dicht'}
          </li>
        ))}
      </ul>
    </div>
  );
}
