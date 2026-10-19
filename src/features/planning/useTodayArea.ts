import { useCallback, useEffect, useState } from 'react';
import { useOnResume } from '../../lib/useOnResume';
import { supabase, uniqueChannel } from '../../lib/supabase';
import { viennaDate } from '../../lib/time';
import { isAreaKey, type AreaKey } from '../nav/areas';

/** The ski area the group decided on for the given day (default: today), or null while undecided. */
export function useDecidedArea(day?: string): AreaKey | null {
  const [area, setArea] = useState<AreaKey | null>(null);
  const date = day ?? viennaDate(new Date());

  const load = useCallback(async () => {
    const { data: poll } = await supabase.from('polls').select('decided_option_id').eq('day', date).eq('kind', 'ski_area').maybeSingle();
    if (!poll?.decided_option_id) return setArea(null);
    const { data: option } = await supabase.from('poll_options').select('value').eq('id', poll.decided_option_id).maybeSingle();
    setArea(isAreaKey(option?.value) ? option.value : null);
  }, [date]);

  const [resume, setResume] = useState(0);
  useOnResume(() => setResume((n) => n + 1));

  useEffect(() => {
    void load();
    const ch = uniqueChannel(`area-${date}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => void load())
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [date, load, resume]);

  return area;
}
