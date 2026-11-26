# Minapp

Privat app for oppgaver og notater (Todoist + Notion-hybrid), PWA for PC og mobil. Brukeren snakker norsk: svar og skriv UI-tekst på norsk (bokmål).

## Teknologi
- Vite, React 19, TypeScript, Tailwind CSS 4. Lint med `oxlint`.
- Backend: Supabase (Postgres med RLS, Edge Functions `send-reminders` og `kaskjerda-tilsyn`, pg_cron).
- Hosting: Cloudflare Workers som statiske filer fra `dist/` (`wrangler.jsonc`).
- Dashboardet «Min dag» henter e-post og nyheter via Google Apps Script (`integrations/google-apps-script/Code.gs`), og status for kaskjerda.no direkte fra kaskjerda.no og GitHub-API-et (uten innlogging).

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
- `src/lib/`: logikk. `store.tsx` (tilstand), `sync.ts` + `supabase.ts` (synk), `parse.ts` (norsk hurtiglegging), `recurrence.ts`, `reminders.ts` + `push.ts` (web push), `settings.ts`, `kaskjerda.ts` (status for kaskjerda.no).
- `supabase/schema.sql` er grunnskjemaet. Endringer legges som nye, nummererte filer i `supabase/migrations/` (neste er 013).
- `supabase/cron.sql` kjører `send-reminders` hvert minutt og `kaskjerda-tilsyn` hvert 15. minutt. Begge bruker `CRON_SECRET`.
- `supabase/functions/kaskjerda-tilsyn/`: åpne GitHub-issues i `Pedersen2k/skjer-i-alesund` med «tilsyn» i tittelen blir oppgaver i I dag (fast id per issue, etikett `kaskjerda`, push via `send-reminders`). Lukkede issues hukes av. Valgfrie hemmeligheter: `MINAPP_USER_ID`, `GITHUB_TOKEN`.

## Regler
- `.env` er med i git med vilje, men har bare offentlige verdier (Supabase publiserbar nøkkel, VAPID offentlig nøkkel). Aldri legg hemmeligheter der. `CRON_SECRET`, VAPID privat nøkkel og Apps Script `KEY` skal aldri inn i repoet.
- Data er beskyttet av RLS. Ny tabell må ha RLS og policyer i samme migrasjon.
- Hold endringer små og fokuserte. Ikke legg til nye avhengigheter uten å si fra.
- Repoet er offentlig: ingen personlige data, e-poster eller tokens i commits.

## Status (oppdatert 2026-11-17)
Finnes i koden: innboks, I dag, Kommende, prosjekter med underprosjekter i opptil tre nivåer og kategorier (seksjoner), etiketter, tavle, kalender, sider med blokkeditor, søk/kommandopalett, påminnelser med web push, innstillinger, «Min dag» med flyttbare/skjulbare kort, dark mode, Supabase-synk.

Nylig jobbet med (branch `tester`): angre-melding (`UndoToast`, `undoable` i store), papirkurv for sider (migrasjon 010), sikkerhetskopi som fil og til Google Drive via Apps Script (`lib/backup.ts`, `BackupDialog`), del til appen og snarveier (manifest + `lib/launch.ts`), sidemeny som dras inn fra venstre kant (`MobileDrawer`). Forslag til mobilmeny ligger i artifacten «Minapp sveipemeny».

Kaskjerda.no (17. nov., i main): kortet «kaskjerda.no» i Min dag (`KaskjerdaCard` i `DashboardCards.tsx`) viser samme vurdering som kaskjerda.no/status/ (varsler, siste 12 kjøringer, programmets alder), nye arrangementer siste døgn (titler når kortet er bredt) og dagens eller neste frist fra planlisten. Varsler om tilsyn blir dessuten oppgaver via `kaskjerda-tilsyn` og vises i «Dagens plan», ikke i kortet (bevisst valg). Opprettelse av oppgave er ikke sett i praksis ennå, bare kjøring uten åpne varsler. Mulig neste steg: besøkstall fra GoatCounter (krever nøkkel på serversiden).

Prosjekter (17. nov.): ny prosjektvisning i `ProjectView.tsx` (hode med fremdriftsring, tall, tidslinje mot frist, «Neste opp», underprosjektkort, kategorier som kort, faner på mobil) og ny visning «Alle prosjekter» (`#/projects`, `ProjectsOverview`). Prosjekter har fått beskrivelse, start, frist, festet og arkivert (migrasjon 011). Synken sender de nye kolonnene bare når feltene er brukt. Designet ligger i artifacten «Minapp prosjekter».

Kontrollvisning (26. nov., steg 1 av 3): «Min dag» har fått visningen «Kontroll» (standard) ved siden av «Kort» (de flyttbare kortene), valgt med `dashboardView` i innstillingene. `Kontroll.tsx` viser Cockpit på PC og Radar på mobil med samme tall; grafene ligger i `charts.tsx` (SVG, fargene `--k-*` i `index.css`) og dataene i `lib/kontroll.ts` (fullførte oppgaver per dag og uke, kaskjerda-status, strømpris). Designet ligger i artifacten «Minapp kontrollrom». Steg 2 (ferdig): besøkstall fra GoatCounter via Edge Function `goatcounter-stats` (krever innlogging; hemmelighet `GOATCOUNTER_TOKEN`, valgfri `GOATCOUNTER_SITE`; tar oppslagene ett om gangen fordi GoatCounter svarer 429 ved for mange per sekund). Hook `useBesok` i `lib/besok.ts`. Funksjonen deployes manuelt til Supabase etter endringer. Steg 3 (ferdig): Jobb/Privat og terskler. Prosjekter har `context` ('jobb' | 'privat', migrasjon 012; underprosjekter arver, uten valg regnes oppgaver som private), valgt i «Rediger prosjekt» under «Hører til». Bryteren Alt/Jobb/Privat i kontrollvisningen (`contextFilter` i innstillingene) filtrerer oppgavene; Jobb skjuler de private kildene (kaskjerda.no, besøk, strøm). Terskler (`lib/kontekst.ts`, `thresholds` i innstillingene, dialog med tannhjulknappen): besøk faller, kjøringer feiler på rad, forfalte oppgaver. De gir varsler i «Varsler»-feltet, ikke push. Neste: e-post til kaskjerda.no som egen kilde, push for terskelvarsler.

## Neste steg
Fyll inn ved start av ny økt. Forslag: avklar designretning fra artifacten, deretter polering av mobilvisning.
