# Minapp

Privat app for oppgaver og notater (Todoist + Notion-hybrid), PWA for PC og mobil. Brukeren snakker norsk: svar og skriv UI-tekst på norsk (bokmål).

## Teknologi
- Vite, React 19, TypeScript, Tailwind CSS 4. Lint med `oxlint`.
- Backend: Supabase (Postgres med RLS, Edge Function `send-reminders`, pg_cron).
- Hosting: Cloudflare Workers som statiske filer fra `dist/` (`wrangler.jsonc`).
- Dashboardet «Min dag» henter e-post og nyheter via Google Apps Script (`integrations/google-apps-script/Code.gs`).

## Kommandoer
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build -> dist/
npm run lint
```
Kjør `npm run build` og `npm run lint` før commit.

## Struktur
- `src/components/`: UI (Dashboard*, TasksView, BoardView, CalendarView, PageEditor, QuickAdd, CommandPalette ...).
- `src/lib/`: logikk. `store.tsx` (tilstand), `sync.ts` + `supabase.ts` (synk), `parse.ts` (norsk hurtiglegging), `recurrence.ts`, `reminders.ts` + `push.ts` (web push), `settings.ts`.
- `supabase/schema.sql` er grunnskjemaet. Endringer legges som nye, nummererte filer i `supabase/migrations/` (neste er 011).
- `supabase/cron.sql` kjører `send-reminders` hvert minutt.

## Regler
- `.env` er med i git med vilje, men har bare offentlige verdier (Supabase publiserbar nøkkel, VAPID offentlig nøkkel). Aldri legg hemmeligheter der. `CRON_SECRET`, VAPID privat nøkkel og Apps Script `KEY` skal aldri inn i repoet.
- Data er beskyttet av RLS. Ny tabell må ha RLS og policyer i samme migrasjon.
- Hold endringer små og fokuserte. Ikke legg til nye avhengigheter uten å si fra.
- Repoet er offentlig: ingen personlige data, e-poster eller tokens i commits.

## Status (oppdatert 2026-10-21)
Finnes i koden: innboks, I dag, Kommende, prosjekter med underprosjekter i opptil tre nivåer og kategorier (seksjoner), etiketter, tavle, kalender, sider med blokkeditor, søk/kommandopalett, påminnelser med web push, innstillinger, «Min dag» med flyttbare/skjulbare kort, dark mode, Supabase-synk.

Nylig jobbet med (branch `tester`): angre-melding (`UndoToast`, `undoable` i store), papirkurv for sider (migrasjon 010), sikkerhetskopi som fil og til Google Drive via Apps Script (`lib/backup.ts`, `BackupDialog`), del til appen og snarveier (manifest + `lib/launch.ts`), sidemeny som dras inn fra venstre kant (`MobileDrawer`). Forslag til mobilmeny ligger i artifacten «Minapp sveipemeny».

### Vital (egen helse-app)
«Helse-appen» = Vital, en norsk app for vitaminer og Wegovy. Den har nå eget repo, `Pedersen2k/vital`, og eget Supabase-prosjekt `vital`. Jobb med Vital skjer der, ikke her. `design/vital/` i Minapp er en eldre kopi av designet.

## Neste steg
Fyll inn ved start av ny økt. Forslag: avklar designretning fra artifacten, deretter polering av mobilvisning.
