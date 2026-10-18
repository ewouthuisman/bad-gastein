# Bad Gastein PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A free, installable PWA for 10 people on a ski trip to Bad Gastein (28 Feb – 6 Mar 2027) with five tabs: Kaart, Berg, AI, Huis, Planning.

**Architecture:** Static React/Vite PWA hosted on GitHub Pages; Supabase (free tier) for auth, Postgres with RLS, Realtime and Edge Functions (push, Soipie, lift status, Soipen commentary). Ski network and places are built once from an OpenStreetMap snapshot into static JSON shipped with the app, so map, routing and house info work offline. All domain logic (routing, Soipen score, tallies, freshness) is pure TypeScript with unit tests.

**Tech Stack:** Node 24, npm, Vite, React 18, TypeScript (strict), react-router (HashRouter), vite-plugin-pwa (injectManifest), MapLibre GL + OpenFreeMap tiles, @supabase/supabase-js, Vitest + Testing Library, Supabase CLI (local stack via Docker; `supabase test db` with pgTAP), Deno Edge Functions, Open-Meteo, Google Gemini API (free tier).

**Spec:** `docs/superpowers/specs/2026-10-18-bad-gastein-pwa-design.md`

## Global Constraints

- Everything must run at €0: GitHub Pages, Supabase free tier, OpenFreeMap, Open-Meteo, Gemini free tier.
- UI copy in **Dutch**; identifiers and code comments in English.
- Trip days: Sun 2027-02-28 … Sat 2027-03-06. Ski days with standard polls: Mon 2027-03-01 … Fri 2027-03-05. Timezone `Europe/Vienna`.
- Tabs, in this order: Kaart, Berg, AI, Huis, Planning.
- Admins: the owner and Sjoerd (role `admin`); everyone else `member`.
- Signup only with the group code.
- Location: shared only while the app is open (every ~30 s or >25 m); grey after **2 h**, hidden after **12 h**.
- Unknown house facts render literally as `[PLACEHOLDER]`.
- No secret (Gemini key, VAPID private key, service-role key) in the client bundle or any committed file; `.env` gitignored, `.env.example` committed.
- No speed tracking, no memes.
- Pushing to `main` triggers the Pages deploy workflow — say so before pushing.

## Review Focus

1. **Route between disconnected network parts** (e.g. Sportgastein ↔ Stubnerkogel needs the ski bus): router must return `{ ok: false, reason: 'no-route' }` and the UI must say so, never draw a partial route. → test in Task 5.
2. **Difficulty cap leaves no route** (beginner, only black pistes down): return `{ ok: false, reason: 'difficulty' }` so the UI can suggest a higher level or taking a lift down. → test in Task 5, message in Task 11.
3. **Vote changed after decision / non-admin calling decide**: votes on a decided poll are rejected by RLS; `decide_poll` by a member raises. → pgTAP in Task 2.
4. **Clock/timezone at day boundaries** (drinks at 00:30 belong to the night before for the "ochtend lager" behaviour; reminders at 20:00 Vienna, i.e. 19:00 UTC in March): pure functions take an explicit `now` and are tested across midnight. → tests in Task 9 and Task 8.
5. **iPhone without home-screen install** (no push, no `Notification` API): `subscribePush` must resolve `{ ok: false, reason: 'unsupported' }` and the UI shows the install guide instead of throwing. → test in Task 7.

---

## File Structure

```
package.json, vite.config.ts, tsconfig.json, index.html, .env.example, .gitignore
public/icons/*, public/data/ski-graph.json, public/data/places.json, public/maps/*.pdf
scripts/fetch-osm.ts          # Overpass → data/osm-snapshot.json (committed)
scripts/build-ski-graph.ts    # snapshot → public/data/ski-graph.json + places.json
scripts/check-routes.ts       # coverage report: house→every lift, every lift→every place
src/main.tsx, src/App.tsx, src/sw.ts
src/lib/supabase.ts, src/lib/time.ts, src/lib/geo.ts
src/auth/AuthProvider.tsx, src/auth/LoginPage.tsx, src/auth/RegisterPage.tsx
src/tabs/KaartTab.tsx, BergTab.tsx, AiTab.tsx, HuisTab.tsx, PlanningTab.tsx
src/features/nav/{types.ts,graph.ts,route.ts,describe.ts,overrides.ts,NavPanel.tsx}
src/features/map/{MapView.tsx,layers.ts}
src/features/location/{freshness.ts,useLocationSharing.ts}
src/features/push/{subscribe.ts,InstallGuide.tsx}
src/features/planning/{tally.ts,PollCard.tsx,DayTimeline.tsx}
src/features/soipen/{score.ts,SoipenMeter.tsx,DrinkButtons.tsx,useBarDwell.ts}
src/features/soipie/ChatPanel.tsx
src/features/berg/{weather.ts,LiftStatus.tsx,PisteMaps.tsx}
src/features/huis/HouseInfo.tsx
src/features/admin/{AdminPage.tsx,NavOverrides.tsx}
supabase/migrations/*.sql, supabase/seed.sql, supabase/tests/*.sql
supabase/functions/{send-push,ping-user,vote-reminder,lift-status,soipie,soipen-comment}/index.ts
supabase/functions/_shared/{context.ts,llm.ts}
.github/workflows/{deploy.yml,keepalive.yml}
tests/**/*.test.ts(x)
```

---

### Task 1: Project scaffold + PWA shell with five tabs

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `.env.example`, `src/main.tsx`, `src/App.tsx`, `src/sw.ts`, `src/tabs/*.tsx` (placeholders), `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
- Test: `tests/App.test.tsx`

**Interfaces:**
- Produces: `<App />` with HashRouter routes `/kaart` (default), `/berg`, `/ai`, `/huis`, `/planning`, `/admin`, `/login`, `/registreer`; bottom tab bar component `TabBar`.

- [ ] **Step 1:** `git init`, `npm create vite@latest . -- --template react-ts`, add `vite-plugin-pwa`, `react-router-dom`, `vitest`, `@testing-library/react`, `jsdom`. `.gitignore` includes `.env`, `node_modules`, `dist`, `supabase/.temp`. `.env.example`: `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=`, `VITE_VAPID_PUBLIC_KEY=`.
- [ ] **Step 2: Write the failing test** `tests/App.test.tsx`: `renders five tabs in order` — asserts tab labels `['Kaart','Berg','AI','Huis','Planning']` in DOM order; `defaults to kaart` — at `#/` the Kaart heading is visible.
- [ ] **Step 3:** Run `npx vitest run tests/App.test.tsx` → FAIL.
- [ ] **Step 4:** Implement `App`, `TabBar`, placeholder tabs. Manifest: `name: "Bad Gastein 2027"`, `short_name: "Gastein"`, `lang: "nl"`, `display: "standalone"`, `start_url: "./#/kaart"`, `scope: "./"`, theme colour of choice. `vite.config.ts` `base: './'`, PWA `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`; precache `data/*.json` and `maps/*`. Apply mobile-native fixes (viewport-fit=cover, safe-area padding, `100dvh`, no tap highlight, 16px inputs).
- [ ] **Step 5:** Run tests → PASS. `npm run build` succeeds.
- [ ] **Step 6:** Commit `feat: scaffold PWA shell with five tabs`.

### Task 2: Supabase schema, RLS and seed

**Files:**
- Create: `supabase/config.toml` (via `npx supabase init`), `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_functions.sql`, `supabase/seed.sql`, `supabase/tests/rls.test.sql`

**Interfaces:**
- Produces tables (all `id uuid default gen_random_uuid()` unless stated, `created_at timestamptz default now()`):
  - `app_config(key text pk, value text)` — row `group_code`.
  - `profiles(id uuid pk → auth.users, display_name text not null, color text not null, role text check in ('admin','member') default 'member', max_difficulty text check in ('novice','easy','intermediate','advanced') default 'intermediate')`
  - `locations(user_id uuid pk → profiles, lat float8, lng float8, accuracy_m float8, updated_at timestamptz)`
  - `places(id, name text, kind text check in ('restaurant','apres','dinner','house','other'), lat, lng, osm_id text unique null, menu_url text, menu_text text, website text, created_by uuid null)`
  - `polls(id, day date, kind text check in ('lunch_place','apres_place','dinner_place','early_ski','lunch_time','apres_or_spa'), decided_option_id uuid null, decided_by uuid null, decided_at timestamptz null, unique(day, kind))`
  - `poll_options(id, poll_id → polls on delete cascade, label text, place_id uuid null → places, value text null, created_by uuid null)`
  - `votes(poll_id → polls, user_id → profiles, option_id → poll_options, updated_at, pk(poll_id,user_id))`
  - `drinks(id, user_id → profiles default auth.uid(), kind text check in ('beer_03','beer_05','jager','wine','shot','gluhwein'), created_at)`
  - `bar_visits(id, user_id default auth.uid(), place_id → places, started_at, ended_at)`
  - `push_subscriptions(endpoint text pk, user_id default auth.uid(), p256dh text, auth text)`
  - `house_info(section text pk, title text, markdown text, sort int, updated_at)`
  - `nav_overrides(id, op text check in ('add_edge','block_edge','set_attr','note'), payload jsonb, created_by)`
  - `lift_status(id text pk, name text, kind text check in ('lift','piste'), is_open bool, updated_at)`
  - `soipen_comments(scope text pk /* 'group' or user uuid */, text text, score int, created_at)`
  - `chat_messages(id, user_id default auth.uid(), role text check in ('user','assistant'), content text, created_at)`
- Produces SQL functions: `is_admin() returns bool` (security definer, stable); `decide_poll(p_poll uuid, p_option uuid) returns void`; `undecide_poll(p_poll uuid) returns void`; trigger `handle_new_user` on `auth.users` insert.

- [ ] **Step 1: Write the failing pgTAP tests** `supabase/tests/rls.test.sql` (use `tests.create_supabase_user`-style helpers or set `request.jwt.claims` manually):
  - signup with wrong `raw_user_meta_data.group_code` raises; with correct code creates `profiles` row with `display_name` from metadata and role `member`.
  - member can `insert`/`update` own `locations`, cannot update another user's row.
  - member can vote on an undecided poll; after `decide_poll` the vote upsert is rejected.
  - member calling `decide_poll` raises `'admin only'`; admin succeeds and `decided_by = auth.uid()`.
  - member cannot `update house_info`; admin can.
  - member can delete own `drinks` row, not another's.
  - anon can select nothing from any table.
- [ ] **Step 2:** `npx supabase start` then `npx supabase test db` → FAIL.
- [ ] **Step 3:** Write migrations. RLS: every table enabled; `select` for `authenticated` on all tables except `push_subscriptions` (own rows only) and `chat_messages` (own rows only); writes on own rows (`user_id = auth.uid()`); `polls` update only via `decide_poll`/`undecide_poll` (security definer, check `is_admin()`); `poll_options` insert by any authenticated, delete by admin or creator before decision; `votes` insert/update only when the poll's `decided_option_id is null`; `house_info`, `nav_overrides`, `app_config` write by admin; `lift_status`, `soipen_comments` write only by service role. `handle_new_user` compares `new.raw_user_meta_data->>'group_code'` with `app_config.group_code`, raises `'invalid group code'` on mismatch. Enable Realtime publication for `locations, votes, poll_options, polls, drinks, soipen_comments, lift_status`.
- [ ] **Step 4:** `seed.sql`: `app_config('group_code','[PLACEHOLDER]')`; one `places` row kind `house` "Panorama Spa Lodges (Das Schiller)" at lat 47.1166, lng 13.1395 *(verify against OSM in Task 4 and correct)*; polls for 2027-03-01…05 × all six kinds; default options: `early_ski` → "Vroeg mee" / "Uitslapen"; `lunch_time` → 11:30, 12:00, 12:30, 13:00, 13:30; `apres_or_spa` → "Après-ski" / "Spa/zwembad"; `dinner_place` → "Thuis koken". `house_info` sections (sort order): `algemeen`, `inbegrepen`, `inchecken`, `kosten`, `wellness`, `regels`, `contact`, `booking`, with confirmed public facts from spec §4.4 and `[PLACEHOLDER]` everywhere else.
- [ ] **Step 5:** `npx supabase db reset && npx supabase test db` → PASS.
- [ ] **Step 6:** Commit `feat: database schema, RLS and seed`.

### Task 3: Auth (register with group code, login, profile)

**Files:**
- Create: `src/lib/supabase.ts`, `src/auth/AuthProvider.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `src/auth/ProfileSheet.tsx`
- Test: `tests/auth/RegisterPage.test.tsx`

**Interfaces:**
- Produces: `supabase` client; `useAuth(): { session, profile: Profile | null, isAdmin: boolean, loading: boolean }`; type `Profile` matching table. Routes other than `/login` and `/registreer` redirect to `/login` when signed out.

- [ ] **Step 1: Failing test:** `RegisterPage` calls `supabase.auth.signUp` with `{ email, password, options: { data: { display_name, group_code } } }` (client mocked); shows "Ongeldige groepscode" when the error message contains `invalid group code`; disables submit while pending.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (email confirmation disabled in Supabase Auth settings so people are in immediately; session persisted in localStorage). Colour picked from a fixed 10-colour palette, defaulting to the first unused. **Step 4:** Run → PASS.
- [ ] **Step 5:** Manual check against local stack: register two users, see each other's profiles. Commit `feat: auth with group code`.

### Task 4: OSM snapshot and ski graph build

**Files:**
- Create: `scripts/fetch-osm.ts`, `scripts/build-ski-graph.ts`, `src/features/nav/types.ts`, `data/osm-snapshot.json`, `public/data/ski-graph.json`, `public/data/places.json`
- Test: `tests/nav/build.test.ts` with fixture `tests/fixtures/mini-osm.json`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  type Difficulty = 'novice'|'easy'|'intermediate'|'advanced'|'expert'|'freeride';
  interface GNode { id: string; lat: number; lng: number; ele?: number; label?: string }
  interface GEdge { id: string; from: string; to: string; kind: 'piste'|'lift'|'link';
    ref?: string; name?: string; difficulty?: Difficulty; liftType?: string;
    lengthM: number; geometry: [number, number][]; osmId?: string; statusId?: string }
  interface SkiGraph { version: string; nodes: GNode[]; edges: GEdge[] }
  interface Place { id: string; name: string; kind: 'restaurant'|'apres'|'dinner'|'house'|'other';
    lat: number; lng: number; nodeId: string; osmId?: string; website?: string; menuUrl?: string }
  ```
- Produces: `buildGraph(osm: OverpassJson, opts?: { snapM?: number }): SkiGraph`; `buildPlaces(osm, graph): Place[]`.

- [ ] **Step 1:** `fetch-osm.ts` queries Overpass for bbox `47.02,12.95,47.26,13.25` (covers Sportgastein, Dorfgastein, Graukogel, Stubnerkogel, Schlossalm): `way["piste:type"="downhill"]`, `relation["route"="piste"]`, `way["aerialway"]`, `nwr["amenity"~"restaurant|bar|pub|cafe|fast_food"]`, `nwr["tourism"~"alpine_hut|apartment|hotel"]["name"~"Schiller",i]`, with `out geom;`, User-Agent set, writes `data/osm-snapshot.json`. Run once; commit the snapshot (builds are reproducible offline).
- [ ] **Step 2: Failing tests** on `mini-osm.json` (hand-made: 1 lift, 2 pistes meeting at a station, 1 restaurant next to a piste, 1 `piste:oneway=no` path):
  - piste edges follow way direction downhill (if `ele`/elevation unknown, use OSM way order; pistes are one-way unless `piste:oneway=no`);
  - aerialway edge `from` = bottom station, `to` = top; `aerialway=magic_carpet|platter|t-bar|chair_lift|gondola|cable_car|mixed_lift|drag_lift` all included, `goods` excluded;
  - endpoints within `snapM = 40` of another way's vertex are joined by a `link` edge both ways;
  - piste `ref` from `piste:ref` ?? `ref` ?? parent `route=piste` relation `ref`;
  - every `Place.nodeId` is the nearest graph node within 150 m, otherwise place dropped with a warning;
  - pistes with `piste:difficulty` in `freeride|expert` are kept but tagged so the router excludes them by default.
- [ ] **Step 3:** Run `npx vitest run tests/nav/build.test.ts` → FAIL. **Step 4:** Implement: split ways into vertex-to-vertex edges only at shared OSM nodes and at snap points; `lengthM` via haversine (`src/lib/geo.ts: haversineM(a,b)`). Place kind: `amenity=bar|pub` or name matches known après list from spec §10 → `apres`; amenity on the mountain (within 150 m of a piste) → `restaurant`; in town → `dinner`; Das Schiller → `house`. **Step 5:** PASS.
- [ ] **Step 6:** Run `npx tsx scripts/build-ski-graph.ts`; print counts (expect ≥ 200 piste edges, ≥ 45 lifts) and the list of lifts/places dropped. Correct the house coordinates in `seed.sql` if they differ from OSM. Commit `feat: OSM ski graph build`.

### Task 5: Router and Dutch route descriptions

**Files:**
- Create: `src/features/nav/graph.ts`, `route.ts`, `describe.ts`, `overrides.ts`
- Test: `tests/nav/route.test.ts`, `tests/nav/describe.test.ts`

**Interfaces:**
- Consumes: `SkiGraph`, `GEdge`, `Difficulty` (Task 4).
- Produces:
  - `applyOverrides(g: SkiGraph, o: NavOverride[]): SkiGraph` where `NavOverride = { op:'add_edge', edge: GEdge } | { op:'block_edge', edgeId } | { op:'set_attr', edgeId, attrs: Partial<GEdge> } | { op:'note', edgeId, text }`.
  - `findRoute(g: SkiGraph, from: string, to: string, opts: { maxDifficulty: Difficulty; closedStatusIds: Set<string> }): RouteResult` where `RouteResult = { ok: true; edges: GEdge[]; totalM: number; minutes: number } | { ok: false; reason: 'no-route'|'difficulty'|'closed' }`.
  - `nearestNode(g, lat, lng): { nodeId: string; distM: number }`.
  - `describeRoute(edges: GEdge[], places: Place[], notes: Map<string,string>): string[]`.

- [ ] **Step 1: Failing tests (`route.test.ts`)** on a hand-built graph:
  - picks shortest by *time* (piste 25 km/h equiv., lift 5 m/s along length plus 2 min boarding, link walk 4 km/h);
  - `maxDifficulty: 'easy'` avoids red (`intermediate`) even if 3× shorter;
  - impossible under cap but possible without → `{ ok:false, reason:'difficulty' }`;
  - disconnected components → `reason:'no-route'`;
  - only path uses a closed lift → `reason:'closed'`;
  - `block_edge` override removes the edge; `add_edge` makes a previously disconnected target reachable.
- [ ] **Step 2: Failing tests (`describe.test.ts`)**:
  - consecutive edges with same `ref` merge into one step: `["Neem piste 27 (blauw)", "Neem lift Stubnerkogelbahn I", "Neem piste 5 (rood)", "Restaurant Jungerstube ligt halverwege piste 5"]`; colours: novice/easy → "blauw", intermediate → "rood", advanced → "zwart";
  - piste without ref uses name, else "volg de piste richting <next lift or place>";
  - destination on a piste interior node → "ligt halverwege" when 25–75% along the merged piste, "aan het begin"/"onderaan" otherwise; side (links/rechts) from the cross product of piste direction and place offset;
  - notes from overrides appended in the matching step: `"… — let op: hier stuk schaatsen"`.
- [ ] **Step 3:** Run → FAIL. **Step 4:** Implement Dijkstra with a binary heap. **Step 5:** Run → PASS.
- [ ] **Step 6:** `scripts/check-routes.ts`: loads the built graph + `places.json`, runs `findRoute` house→every lift bottom station and every lift top → every `restaurant`/`apres` place at `maxDifficulty:'intermediate'`, writes `docs/route-check.md` listing failures and routes containing `link` edges longer than 100 m (suspicious). Run it; fix systematic build issues in Task 4 code; leave remaining specific gaps for overrides. Commit `feat: piste router and route descriptions`.

### Task 6: Map tab with people, places and location sharing

**Files:**
- Create: `src/features/map/MapView.tsx`, `layers.ts`, `src/features/location/freshness.ts`, `useLocationSharing.ts`, `src/tabs/KaartTab.tsx`
- Test: `tests/location/freshness.test.ts`, `tests/location/useLocationSharing.test.ts`

**Interfaces:**
- Consumes: `SkiGraph`, `Place` from `/data/*.json`; `supabase`; `useAuth`.
- Produces: `locationFreshness(updatedAt: Date, now: Date): 'fresh'|'stale'|'hidden'` (stale ≥ 2 h, hidden ≥ 12 h); `formatAgo(updatedAt, now): string` ("net", "4 min geleden", "1 u 20 min geleden"); `useLocationSharing(): { lastSent: Date|null; error: string|null; shareNow(): Promise<void> }`; `<MapView onSelectPlace onSelectPerson routeEdges?/>`.

- [ ] **Step 1: Failing tests:** freshness boundaries at 1:59:59 / 2:00:00 / 11:59 / 12:00; `formatAgo` values above; `useLocationSharing` (mock `navigator.geolocation.watchPosition`, fake timers) upserts on first fix, skips when <30 s and <25 m since last send, sends when moved 26 m, sends when 30 s elapsed; stops watching on `visibilitychange` hidden and resumes on visible.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. MapLibre style `https://tiles.openfreemap.org/styles/liberty`; layers: pistes coloured by difficulty, lifts dashed black, places with icons per kind, people as coloured circles with initials (opacity 0.4 when stale). Realtime subscription on `locations`. Person sheet: "Waar ben je?" (calls Task 7), "Route naar …". Place sheet: name, kind, menu (text or link), "Route hierheen" → opens Berg nav with destination preset (`/berg?to=<placeId>`). Filter chips: Mensen / Restaurants / Après / Liften. Camera initially fits the house and Stubnerkogel. **Step 4:** PASS.
- [ ] **Step 5:** Manual check in browser preview with two accounts (devtools geolocation override). Commit `feat: map with live group locations`.

### Task 7: Web Push and "Waar ben je?"

**Files:**
- Create: `src/features/push/subscribe.ts`, `InstallGuide.tsx`, push handler in `src/sw.ts`, `supabase/functions/send-push/index.ts`, `supabase/functions/ping-user/index.ts`
- Test: `tests/push/subscribe.test.ts`

**Interfaces:**
- Produces: `subscribePush(): Promise<{ ok: true } | { ok: false; reason: 'unsupported'|'denied'|'error' }>`; `isStandalone(): boolean`; `platform(): 'ios'|'android'|'other'`.
- Produces internal helper in `send-push`: POST `{ userIds: string[] | 'all', title: string, body: string, url: string }` (service-role only, checked via `Authorization` = service key). `ping-user`: POST `{ targetUserId }` from an authenticated user → push "📍 <naam> vraagt waar je bent" with url `#/kaart?share=1`; rate limit 1 ping per sender→target per 5 min.

- [ ] **Step 1: Failing tests:** `subscribePush` returns `unsupported` when `PushManager` or `Notification` missing (iOS Safari not installed); `denied` when permission denied; on success upserts `{ endpoint, p256dh, auth }`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Generate VAPID keys with `npx web-push generate-vapid-keys`; public key → `.env` `VITE_VAPID_PUBLIC_KEY`, private → `npx supabase secrets set VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:<owner email>`. Edge function uses `npm:web-push`; deletes subscriptions that return 404/410. SW `push` shows notification; `notificationclick` focuses/opens `url`; opening with `share=1` triggers `shareNow()`. `InstallGuide`: per-platform steps (iOS: Safari → Deel → "Zet op beginscherm"; Android: menu → "App installeren"), shown on first launch when `!isStandalone()` and from the profile sheet. **Step 4:** PASS.
- [ ] **Step 5:** Manual check on a real Android phone and iPhone (installed) via the deployed preview. Commit `feat: web push and location ping`.

### Task 8: Planning tab with votes, decisions and reminders

**Files:**
- Create: `src/features/planning/tally.ts`, `PollCard.tsx`, `DayTimeline.tsx`, `src/tabs/PlanningTab.tsx`, `supabase/migrations/0004_decision_push.sql`, `supabase/functions/vote-reminder/index.ts`, `src/lib/time.ts`
- Test: `tests/planning/tally.test.ts`, `tests/planning/PollCard.test.tsx`, `tests/lib/time.test.ts`

**Interfaces:**
- Consumes: tables from Task 2, `decide_poll`, `send-push`.
- Produces: `tally(options: PollOption[], votes: Vote[]): { optionId: string; count: number; voters: string[] }[]` sorted by count desc then label; `tripDays(): { date: string; label: string; isSkiDay: boolean }[]` (7 days, labels "zo 28 feb" … "za 6 mrt"); `viennaDate(now: Date): string` (YYYY-MM-DD in Europe/Vienna); `reminderDue(now: Date): boolean` (true when Vienna local time is 20:00–20:14).

- [ ] **Step 1: Failing tests:** `tally` ties sorted by label, voters listed by display name; `tripDays()[0]` = `{date:'2027-02-28', label:'zo 28 feb', isSkiDay:false}`, index 1..5 `isSkiDay:true`; `viennaDate(new Date('2027-03-01T23:30:00Z'))` = `'2027-03-02'`; `reminderDue(new Date('2027-03-01T19:05:00Z'))` true, `…T20:05Z` false. `PollCard`: shows "Besluit" button only when `isAdmin`; after decision shows decided option with a "Route" button (place polls) and disables voting; "Plek voorstellen" opens a picker over `places` filtered by kind (`restaurant` for lunch, `apres` for après, `dinner` for dinner) plus "Nieuwe plek" (name + optional link).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Day timeline order per ski day: Vroeg skiën (early_ski) → Lunch (lunch_place + lunch_time) → Après-ski (apres_place + apres_or_spa) → Avondeten (dinner_place) → Slapen (static). Sun/Sat: static blocks plus admin "Stemming toevoegen". Default selected day = today in Vienna if within trip, else first ski day. Realtime on `votes`, `poll_options`, `polls`. Decided place shows its menu (text or link) and "Route hierheen". `0004_decision_push.sql`: trigger on `polls` update when `decided_option_id` becomes non-null → `pg_net` POST to `send-push` with `userIds:'all'`, title `"Besloten: <kind label> <dag>"`, body `"<option label>[, <lunch time if decided>]"`. `vote-reminder`: pg_cron every 15 min calls it; it exits unless `reminderDue(now)`; for tomorrow's ski-day polls, pushes to users lacking a vote on any undecided poll: "Je hebt nog niet gestemd voor morgen". Store last run date to avoid double sends. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: planning with votes and decisions`.

### Task 9: Soipen-meter

**Files:**
- Create: `src/features/soipen/score.ts`, `SoipenMeter.tsx`, `DrinkButtons.tsx`, `useBarDwell.ts`, `supabase/functions/soipen-comment/index.ts`, `src/features/soipen/fallbackLines.ts`
- Test: `tests/soipen/score.test.ts`, `tests/soipen/useBarDwell.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type DrinkKind = 'beer_03'|'beer_05'|'jager'|'wine'|'shot'|'gluhwein';
  const DRINK_POINTS: Record<DrinkKind, number> = { beer_03: 6, beer_05: 10, jager: 8, wine: 7, shot: 8, gluhwein: 7 };
  personalScore(input: { drinks: {kind: DrinkKind; at: Date}[]; barMinutes: {start: Date; end: Date}[] }, now: Date): number // 0–100
  groupScore(personal: number[], votes: { apresShare: number|null; earlyShare: number|null }): number // 0–100
  soipenMode(score: number): { key: 'ski'|'lunch'|'apres'|'overgave'; label: string }
  ```
  Formula (builder's call, per spec §11): raw = Σ points × 0.5^(ageHours/6) + Σ barMinutes/6 × 0.5^(ageHours/6); personal = round(100 × (1 − e^(−raw/40))). group = clamp(mean(personal) + (apresShare − 0.5) × 20 − (earlyShare − 0.5) × 10), null shares contribute 0. Modes: 0–24 "Skimodus", 25–49 "Lunchpauze-met-risico", 50–79 "Après-ski modus", 80–100 "Totale overgave".
- Produces: `useBarDwell(position, apresPlaces)` — starts a `bar_visits` row when within 60 m of an `apres` place, ends it after 5 min outside or when the app is hidden (caps a visit at 4 h).

- [ ] **Step 1: Failing tests:** zero input → 0; one `beer_05` now → `round(100*(1-e^-0.25))` = 22; same beer 6 h ago → 12; five beers + 2 jagers at 23:00, evaluated 08:00 next day → > 0 and < evening value (the "ochtend lager, niet 0" rule); score never > 100 with 40 drinks; `groupScore([60,70],{apresShare:1,earlyShare:null})` = 75; modes at 24/25/49/50/79/80. `useBarDwell`: enter radius → insert; leave for 4 min → no end; 5 min → end.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. `SoipenMeter`: big gauge with group score, mode label, commentary line, personal meter "Jij: 82% — …", ranking list (display name + score). Commentary: read `soipen_comments` (Realtime); `soipen-comment` edge function runs via pg_cron every 30 min between 10:00 and 02:00 Vienna and on demand (max once per 10 min), computes scores server-side using the same formula (copy `score.ts` into `supabase/functions/_shared/score.ts`; a test asserts both files are byte-identical), asks the LLM (Task 10 `_shared/llm.ts`) for one dry Dutch sentence for the group and one per person, referencing real numbers and recent bars; on LLM failure writes a random line from `fallbackLines.ts` for the mode. `DrinkButtons`: six large buttons with labels "Bier 0,3", "Bier 0,5", "Jägermeister", "Wijn", "Shot", "Glühwein"; toast with "Ongedaan maken" (deletes the row) for 10 s. Satire disclaimer line under the meter. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: soipen-meter`.

### Task 10: Soipie chatbot

**Files:**
- Create: `supabase/functions/_shared/llm.ts`, `_shared/context.ts`, `supabase/functions/soipie/index.ts`, `src/features/soipie/ChatPanel.tsx`, `src/tabs/AiTab.tsx`
- Test: `supabase/functions/_shared/context_test.ts` (Deno test), `tests/soipie/ChatPanel.test.tsx`

**Interfaces:**
- Produces: `complete(messages: {role:'system'|'user'|'assistant'; content:string}[], opts?: {maxTokens?: number}): Promise<string>` — Gemini via REST (`GEMINI_API_KEY`, model from `GEMINI_MODEL`, default the current free-tier Flash model; look up the exact id at implementation time); on 429/5xx falls back to OpenRouter if `OPENROUTER_API_KEY` set (model `OPENROUTER_MODEL`, a `:free` model).
- Produces: `buildContext(db: SupabaseClient, now: Date): Promise<string>` — compact Dutch text with sections: Vandaag/Planning (all days, decisions, poll tallies with names), Huis (house_info markdown), Plekken (places with menu text truncated to 600 chars each), Liftstatus (closed lifts/pistes + updated time), Weer (`_shared/weather.ts` fetches Open-Meteo with the same two points and fields Task 11 specifies for `fetchWeather`; Task 11's client version must stay consistent with it), Soipen (scores + modes), Locaties (name, nearest place, ago). Hard cap 24 000 characters, dropping menu text first.
- `soipie` POST `{ message: string }` (authenticated): enforces 25 user messages/user/Vienna-day and 150/day total → 429 with Dutch message "Soipie heeft even genoeg gehad. Morgen weer."; loads last 10 own `chat_messages`; system prompt: name Soipie, Dutch, dry and teasing, only use facts from the context, say "weet ik niet" otherwise, never give real medical/alcohol-safety advice beyond "drink water"; stores both messages; returns `{ reply }`.

- [ ] **Step 1: Failing tests:** `buildContext` with a stub client includes decided lunch label and "[PLACEHOLDER]" house text verbatim, stays ≤ 24 000 chars when given 50 long menus; `ChatPanel` renders history, disables send while pending, shows the 429 message.
- [ ] **Step 2:** Run (`npx vitest run tests/soipie` and `deno test supabase/functions/_shared`) → FAIL. **Step 3:** Implement. AI tab layout: Soipen-meter on top, "Vraag het Soipie" chat below. Suggested prompts chips: "Waar lunchen we morgen?", "Welke liften zijn dicht?", "Wie is het meest gesoipt?". **Step 4:** PASS.
- [ ] **Step 5:** Manual check against local functions (`npx supabase functions serve`) with a real Gemini key in `supabase/functions/.env` (gitignored). Commit `feat: soipie chatbot`.

### Task 11: Berg tab — weather, lift status, piste maps, navigation UI

**Files:**
- Create: `src/features/berg/weather.ts`, `LiftStatus.tsx`, `PisteMaps.tsx`, `src/features/nav/NavPanel.tsx`, `src/tabs/BergTab.tsx`, `supabase/functions/lift-status/index.ts`, `supabase/functions/lift-status/parse.ts`, `public/maps/*`
- Test: `tests/berg/weather.test.ts`, `supabase/functions/lift-status/parse_test.ts` with a saved HTML/JSON fixture, `tests/nav/NavPanel.test.tsx`

**Interfaces:**
- Consumes: `findRoute`, `describeRoute`, `nearestNode`, `applyOverrides` (Task 5); `lift_status`; `nav_overrides`.
- Produces: `fetchWeather(): Promise<{ valley: DayForecast[]; summit: DayForecast[] }>` where `DayForecast = { date: string; tMin: number; tMax: number; snowCm: number; windMaxKmh: number; cloudPct: number; code: number }`, querying Open-Meteo for valley (47.1150, 13.1340, elevation 1000) and summit (Stubnerkogel 47.1063, 13.0915, elevation 2246) with `timezone=Europe/Vienna`; cached in localStorage 30 min (try/catch). `parseLiftStatus(raw: string): { id: string; name: string; kind: 'lift'|'piste'; isOpen: boolean }[]`.

- [ ] **Step 1: Investigate the source.** Open `https://skigastein.com/en/lifts-ski-runs-winter` (and the Intermaps "INFO daily" report link it contains, winter variant) in the browser pane, inspect network requests for a JSON/XHR feed. Save one response as the fixture. If out of season the feed may show everything closed — that is fine for parsing. Record the URL in `supabase/functions/lift-status/SOURCE.md`. If no machine-readable source exists, implement the spec §12 fallback (link + "liftstatus onbekend") and skip Steps 2–4 for parsing.
- [ ] **Step 2: Failing tests:** `parseLiftStatus(fixture)` returns ≥ 40 lifts with names; `fetchWeather` maps a recorded Open-Meteo response correctly; `NavPanel`: choosing start "Hier" uses `nearestNode` on current position; selecting a decided lunch place via `?to=` preset fills the destination; difficulty select defaults to the profile's `max_difficulty` and persists changes; `reason:'difficulty'` shows "Geen route op dit niveau — probeer een hoger niveau of neem een lift naar beneden"; `no-route` shows "Geen route over de piste. Misschien is de skibus nodig."; route steps render as a numbered list and the route is drawn on the map.
- [ ] **Step 3:** Run → FAIL. **Step 4:** Implement. `lift-status` runs via pg_cron every 15 min from 07:30–17:30 Vienna, upserts `lift_status`; map lift status ids to graph `statusId` by normalised name (lowercase, strip "bahn", roman numerals kept) — unmatched names listed in function logs. Berg tab sections: Navigatie (top), Liften & pistes (open/dicht chips, "laatst bijgewerkt hh:mm", link "Officiële status"), Weer (valley/summit, 5 days), Pistekaarten (download the official Skigastein/Dorfgastein panorama PDFs into `public/maps/` if their licence permits offline copies; otherwise link out; zoomable viewer). Start options: Hier, Huis, any lift (boven/onder), any place, any person. **Step 5:** PASS.
- [ ] **Step 6:** Commit `feat: berg tab with weather, lift status and navigation`.

### Task 12: Huis tab and admin pages

**Files:**
- Create: `src/features/huis/HouseInfo.tsx`, `src/tabs/HuisTab.tsx`, `src/features/admin/AdminPage.tsx`, `NavOverrides.tsx`
- Test: `tests/huis/HouseInfo.test.tsx`, `tests/admin/NavOverrides.test.tsx`

**Interfaces:**
- Consumes: `house_info`, `nav_overrides`, `app_config`, `useAuth().isAdmin`, `applyOverrides`.
- Produces: none for later tasks.

- [ ] **Step 1: Failing tests:** `HouseInfo` renders sections in `sort` order, renders `[PLACEHOLDER]` visibly highlighted, shows "Bewerken" only for admins, saving calls update with the new markdown; Booking section renders its link as a button "Open in Booking" (hidden while it is `[PLACEHOLDER]`); the house address opens a map route. `NavOverrides`: admin selects an edge on the map → actions "Blokkeren", "Kleur/nummer aanpassen", "Notitie", and "Verbinding toevoegen" (tap two nodes) → inserts the matching `nav_overrides` payload; list shows existing overrides with delete.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Render markdown with a small sanitising renderer (e.g. `marked` + `DOMPurify`). Admin page (`/admin`, linked from profile sheet for admins): group code, nav overrides, link to `docs/route-check.md` results summary (embed counts at build time). Overrides cached offline (localStorage, try/catch). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: huis tab and admin tools`.

### Task 13: Deploy, keep-alive and route verification pass

**Files:**
- Create: `.github/workflows/deploy.yml`, `.github/workflows/keepalive.yml`, `README.md`

- [ ] **Step 1:** Create the Supabase cloud project (owner authorises the Supabase MCP/CLI login; region `eu-central-1`). `npx supabase link`, `npx supabase db push`, `npx supabase functions deploy`, set secrets (`GEMINI_API_KEY`, `OPENROUTER_API_KEY` optional, `VAPID_*`). In Auth settings: disable email confirmation; set site URL to the Pages URL. Set the real group code via SQL (owner chooses). Enable `pg_cron` + `pg_net` and register the schedules from Tasks 8, 9, 11.
- [ ] **Step 2:** `deploy.yml`: on push to `main`, `npm ci && npm test -- --run && npm run build` with `VITE_*` from repo secrets, deploy `dist` via `actions/deploy-pages`. Create the GitHub repo `ewouthuisman/bad-gastein` (private repo + Pages requires a paid plan → make the repo **public**; no secrets are committed — confirm with the owner before creating). Ask before the first push (it deploys).
- [ ] **Step 3:** `keepalive.yml`: cron `0 6 */3 * *` until 2027-03-07, `curl` a `select` on `app_config` via REST with the anon key from secrets.
- [ ] **Step 4:** Run `npx tsx scripts/check-routes.ts` on the final graph; walk through `docs/route-check.md` against the official piste map; add overrides for real gaps; list remaining doubts for the owner.
- [ ] **Step 5:** End-to-end check on the deployed URL from an Android phone and an iPhone (installed to home screen): register, see each other on the map, ping, vote, decide (admin), receive push, log a drink, ask Soipie a question, plan a route offline (airplane mode). README: share link, install instructions, how to edit house info, how to add overrides. Commit `chore: deploy and keep-alive`.
