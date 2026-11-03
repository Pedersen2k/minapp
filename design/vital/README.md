# Vital: designforslag (vitaminer og Wegovy)

Designforslag for en egen app, separat fra Minapp. Ligger her kun som designkilde og
deployes ikke: Cloudflare-bygget tar bare `dist/` og rører ikke `design/`.

- `vital-static.html`: statisk HTML med alle skjermene side om side, uten scripts. Dette er den oppdaterte versjonen.
- `source/project/`: første designkilde (`Main.dc.html` = I dag, `Wegovy.dc.html` = Wegovy, `canvas.json` = oppsett). Har ikke rettelsene eller de nye skjermene.

Mørk glass-UI i Apple-stil, 390×844 per skjerm. Eksempeldata, ikke koblet til Supabase.

## Skjermer
1. **I dag**: dagens vitaminer med avkrysning, fremdriftsring og rekke.
2. **Wegovy**: neste dose, dose-opptrapping (0,25 → 2,4 mg), påminnelser, doser igjen i pennen og vekt siden start.
3. **Vitaminer**: brukerens egne vitaminer gruppert på tidspunkt (morgen, kveld, ukentlig), med frekvens og beholdning. Varsel når det snart er tomt.
4. **Nytt vitamin** (ark): søk eller velg vanlige tilskudd (D-vitamin, omega-3, tran, B12, jern, folat …), dose med enhet (µg, mg, IE, stk), hvor ofte (hver dag, annenhver dag, valgte dager, ukentlig), ett eller flere tidspunkt, «ta med mat», påminnelse og beholdning.
5. **Innsikt**: vektkurve med doseskifter markert, vitaminkalender for måneden, bivirkninger siste 30 dager og rapport til legetimen.
6. **Logg injeksjon** (ark over Wegovy): dose og tidspunkt, injeksjonssted på en kroppsfigur (mage, lår, overarm, venstre/høyre) med forrige sted markert, bivirkninger siden sist, vekt og notat.

## Prinsipper
- Norsk først: norske ukedager (M T O T F L S), komma som desimaltegn, «µg» og «IE» som enheter.
- Brukeren bestemmer selv hvilke vitaminer, hvor mye og hvor ofte. Appen gir ikke medisinske råd.
- Ingen nye data uten at de vises igjen et sted (beholdning → «snart tomt», bivirkninger → Innsikt).
