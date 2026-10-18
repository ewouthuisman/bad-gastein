import { useAuth } from '../../auth/AuthProvider';
import { fallbackLine } from '../../../supabase/functions/_shared/fallbackLines.ts';
import { soipenMode } from './score';
import { useSoipen } from './useSoipen';

function Gauge({ value }: { value: number }) {
  // Semicircle from 180° (0%) to 0° (100%).
  const angle = Math.PI * (1 - value / 100);
  const r = 80;
  const x = 100 + r * Math.cos(angle);
  const y = 100 - r * Math.sin(angle);
  return (
    <svg viewBox="0 0 200 115" className="gauge" role="img" aria-label={`Soipen-meter ${value}%`}>
      <defs>
        <linearGradient id="soipen-grad" x1="0" x2="1">
          <stop offset="0%" stopColor="#4cc38a" />
          <stop offset="50%" stopColor="#ffb547" />
          <stop offset="100%" stopColor="#ef5d5d" />
        </linearGradient>
      </defs>
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#ffffff22" strokeWidth="16" strokeLinecap="round" />
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#soipen-grad)" strokeWidth="16" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * 251.3} 999`} />
      <circle cx={x} cy={y} r="9" fill="#fff" />
      <text x="100" y="92" textAnchor="middle" fontSize="30" fontWeight="800" fill="currentColor">{value}%</text>
    </svg>
  );
}

/** Soipie's line, unless the score has moved on since it was written. */
function line(c: { text: string; score: number } | undefined, score: number): string {
  return c && Math.abs(c.score - score) < 15 ? c.text : fallbackLine(soipenMode(score).key);
}

export function SoipenMeter() {
  const { session } = useAuth();
  const { snapshot, comments } = useSoipen();
  if (!snapshot) return <div className="card muted">Soipen-meter laden…</div>;
  const me = snapshot.people.find((p) => p.id === session?.user.id);
  const groupLine = line(comments.get('group'), snapshot.group);

  return (
    <div className="card soipen">
      <p className="muted" style={{ margin: 0 }}>Huidige groepsstatus</p>
      <h2 style={{ marginTop: 4 }}>{snapshot.mode.label}</h2>
      <Gauge value={snapshot.group} />
      <p className="soipen-line">“{groupLine}”</p>
      {me && (
        <p className="soipen-me">
          <strong>Jij: {me.score}%</strong> — {line(comments.get(me.id), me.score)}
        </p>
      )}
      <h3>Soipen-ranking</h3>
      <ol className="ranking">
        {snapshot.people.map((p) => (
          <li key={p.id} className={p.id === me?.id ? 'me' : ''}>
            <span>{p.name}</span>
            <span className="muted">{p.drinksToday} vandaag</span>
            <span className="score">{p.score}%</span>
          </li>
        ))}
      </ol>
      <p className="muted small-print">Satire. Geen promillagemeter. Drink water en rijd niet.</p>
    </div>
  );
}
