import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

/** Service-role client: bypasses RLS, only for use inside edge functions. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

/** Resolves the calling user from their JWT, or null. */
export async function callerId(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

const settingsCache = new Map<string, string | null>();

/** A server-only setting: function secret (env) first, else private.settings in the database. */
export async function setting(name: string): Promise<string | null> {
  const env = Deno.env.get(name);
  if (env) return env;
  if (settingsCache.has(name)) return settingsCache.get(name)!;
  const { data } = await adminClient().rpc('server_setting', { k: name });
  const value = (data as string | null) || null;
  if (value) settingsCache.set(name, value);
  return value;
}

/** Calls from the database (pg_net triggers, pg_cron) carry a shared secret instead of a user JWT. */
export async function isInternal(req: Request): Promise<boolean> {
  const secret = await setting('HOOK_SECRET');
  return !!secret && req.headers.get('x-hook-secret') === secret;
}
