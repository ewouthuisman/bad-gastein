# Bad Gastein 2027

Groeps-app (PWA) voor de wintersport van zondag 28 februari t/m zaterdag 6 maart 2027 in
Panorama Spa Lodges (Das Schiller), Kötschachtaler Straße 5, Bad Gastein.

Vijf tabs: **Kaart** (waar is iedereen, restaurants, après), **Berg** (navigatie over de pistes,
live liftstatus, weer, pistekaarten), **AI** (Soipen-meter en Soipie), **Huis** (alles over het huis)
en **Planning** (dagplanning met stemmen).

Ontwerp: [docs/superpowers/specs/2026-10-18-bad-gastein-pwa-design.md](docs/superpowers/specs/2026-10-18-bad-gastein-pwa-design.md)

## Voor de groep

1. Open de link die in de groepsapp gedeeld is.
2. **iPhone:** in Safari → deel-icoon → *Zet op beginscherm*. **Android:** Chrome-menu → *App installeren*.
3. Open de app vanaf je beginscherm, maak een account met de groepscode en zet meldingen aan
   (rondje rechtsboven → *Meldingen aanzetten*).

Je locatie wordt alleen gedeeld zolang de app open is (zo werken web-apps). Met *Waar ben je?* vraag je
iemand de app even te openen.

## Voor admins

- **Huisinfo aanvullen:** Huis-tab → *Bewerken* bij een blok. Alles met `[PLACEHOLDER]` moet nog ingevuld worden.
  Zet de Booking-link in het blok *Boeking*; dan verschijnt de knop *Open in Booking*.
- **Besluiten:** in Planning bij een stemming op *Besluit* drukken. Iedereen krijgt een melding.
- **Pistenetwerk corrigeren:** rondje rechtsboven → *Beheer* → zoek een piste op nummer of naam en
  blokkeer hem, verander de kleur of zet er een notitie bij. Ontbrekende stukjes lopen/schaatsen voeg je
  toe met *Verbinding toevoegen*. Zie [docs/route-check.md](docs/route-check.md) voor routes die nu niet lukken.
- **Pistekaart:** plak in *Beheer* de PDF-link van de officiële winterkaart zodra Skigastein die publiceert.
- **Admin maken:** in de Supabase SQL-editor: `update profiles set role = 'admin' where display_name = 'Naam';`

## Ontwikkelen

Vereist Node 24 en Docker (voor de lokale Supabase).

```bash
npm install
npx supabase start
npx supabase db reset
npm run dev
```

- `.env.local` (niet in git): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY` — zie `.env.example`.
- `supabase/functions/.env` (niet in git): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `HOOK_SECRET`,
  optioneel `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`.
- Edge functions lokaal: `npx supabase functions serve --env-file supabase/functions/.env`
- Tests: `npx vitest run` (app) en `npx supabase test db` (database/RLS).
- Pistenetwerk opnieuw bouwen: `npx tsx scripts/fetch-osm.ts` (alleen als je verse OSM-data wilt),
  `npx tsx scripts/build-ski-graph.ts`, daarna `npx tsx scripts/check-routes.ts`.

Een push naar `main` deployt automatisch naar GitHub Pages.

## Online zetten (checklist — alleen nodig bij een nieuw Supabase-project; voor de huidige versie is dit al gedaan)

1. Supabase-project: alle migraties toepassen (eerst `npx supabase link --project-ref <ref>`, dan `npx supabase db push`).
2. In Supabase → Authentication → Sign In / Providers → Email: **Confirm email uit**.
3. Edge functions deployen (send-push, ping-user, notify-decision, vote-reminder, lift-status, soipen-comment, soipie);
   de interne functies (alle behalve ping-user en soipie) zonder JWT-check.
4. Edge function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `HOOK_SECRET`, `GEMINI_API_KEY`.
5. In de database `private.settings` vullen: `functions_url` = `https://<project>.supabase.co/functions/v1` en
   `hook_secret` = dezelfde waarde als `HOOK_SECRET`. Zonder deze twee gaan er stilletjes geen meldingen,
   herinneringen, liftstatus of Soipen-commentaar uit.
6. Groepscode instellen: `update app_config set value = '<code>' where key = 'group_code';` (of via Beheer).
7. GitHub: repo-variabelen `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`; Pages-bron = GitHub Actions.
