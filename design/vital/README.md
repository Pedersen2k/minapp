# Vital: designforslag (vitaminer og Wegovy)

Designforslag for en egen app, separat fra Minapp. Ligger her kun som designkilde og
deployes ikke: Cloudflare-bygget tar bare `dist/` og rører ikke `design/`.

- `vital-static.html`: statisk HTML med alle skjermene side om side, uten scripts.
- `source/project/`: designkilden, én `.dc.html` per skjerm (se lista under) og `canvas.json` med oppsettet (appskjermer på første rad, førstegangsoppsett på andre).
- `skjermer.jpg`: bilde av alle skjermene.

Begge versjonene har samme innhold. Endrer du én, oppdater den andre.

Mørk glass-UI i Apple-stil, 390×844 per skjerm. Eksempeldata, ikke koblet til Supabase.

## Skjermer
1. **I dag** (`Main`): dagens vitaminer med avkrysning, fremdriftsring og rekke.
2. **Wegovy** (`Wegovy`): neste dose, dose-opptrapping (0,25 → 2,4 mg), påminnelser, doser igjen i pennen og vekt siden start.
3. **Vitaminer** (`Vitaminer`): brukerens egne vitaminer gruppert på tidspunkt (morgen, kveld, ukentlig), med frekvens og beholdning. Varsel når det snart er tomt.
4. **Nytt vitamin** (`NyttVitamin`, ark): søk eller velg vanlige tilskudd (D-vitamin, omega-3, tran, B12, jern, folat …), dose med enhet (µg, mg, IE, stk), hvor ofte (hver dag, annenhver dag, valgte dager, ukentlig), ett eller flere tidspunkt, «ta med mat», påminnelse og beholdning.
5. **Innsikt** (`Innsikt`): vektkurve med doseskifter markert, vitaminkalender for måneden, bivirkninger siste 30 dager og rapport til legetimen.
6. **Logg injeksjon** (`LoggInjeksjon`, ark over Wegovy): dose og tidspunkt, injeksjonssted på en kroppsfigur (mage, lår, overarm, venstre/høyre) med forrige sted markert, bivirkninger siden sist, vekt og notat.
7–9. **Førstegangsoppsett** (`Oppsett1`–`Oppsett3`) i tre steg: velg vitaminer og Wegovy, bare vitaminer eller bare Wegovy; kryss av vitaminene du tar og når på dagen; dosen du tar nå, startdato, injeksjonsdag, klokkeslett, startvekt og varsler. Hopper man over Wegovy, blir det to steg.

## Prinsipper
- Norsk først: norske ukedager (M T O T F L S), komma som desimaltegn, «µg» og «IE» som enheter.
- Brukeren bestemmer selv hvilke vitaminer, hvor mye og hvor ofte. Appen gir ikke medisinske råd.
- Ingen nye data uten at de vises igjen et sted (beholdning → «snart tomt», bivirkninger → Innsikt).
