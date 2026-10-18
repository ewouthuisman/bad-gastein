// Pure Soipen snapshot computation, used by the soipen-comment function and by the app.
import { groupScore, personalScore, soipenMode, type DrinkKind } from './score.ts';
import { viennaDate } from './time.ts';

export interface SoipenRows {
  profiles: { id: string; display_name: string }[];
  drinks: { user_id: string; kind: string; created_at: string }[];
  visits: { user_id: string; started_at: string; ended_at: string | null; places?: { name?: string } | null }[];
  polls: { id: string; kind: string }[];
  votes: { poll_id: string; option_id: string }[];
  options: { id: string; value: string | null }[];
}

export interface SoipenPerson {
  id: string;
  name: string;
  score: number;
  drinksToday: number;
  lastBar: string | null;
}

export interface SoipenSnapshot {
  group: number;
  mode: ReturnType<typeof soipenMode>;
  people: SoipenPerson[]; // highest score first
}

export function computeSnapshot(rows: SoipenRows, now: Date): SoipenSnapshot {
  const today = viennaDate(now);
  const valueOf = new Map(rows.options.map((o) => [o.id, o.value]));
  const share = (kind: string, value: string) => {
    const poll = rows.polls.find((p) => p.kind === kind);
    const vs = rows.votes.filter((v) => v.poll_id === poll?.id);
    return vs.length ? vs.filter((v) => valueOf.get(v.option_id) === value).length / vs.length : null;
  };

  const people = rows.profiles
    .map((p) => {
      const mine = rows.drinks.filter((d) => d.user_id === p.id);
      const visits = rows.visits.filter((v) => v.user_id === p.id).sort((a, b) => b.started_at.localeCompare(a.started_at));
      const score = personalScore(
        {
          drinks: mine.map((d) => ({ kind: d.kind as DrinkKind, at: new Date(d.created_at) })),
          barMinutes: visits.map((v) => ({ start: new Date(v.started_at), end: v.ended_at ? new Date(v.ended_at) : null })),
        },
        now,
      );
      return {
        id: p.id,
        name: p.display_name,
        score,
        drinksToday: mine.filter((d) => viennaDate(new Date(d.created_at)) === today).length,
        lastBar: visits[0]?.places?.name ?? null,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'nl'));

  const group = groupScore(
    people.map((p) => p.score),
    { apresShare: share('apres_or_spa', 'apres'), earlyShare: share('early_ski', 'early') },
  );
  return { group, mode: soipenMode(group), people };
}
