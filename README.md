# Minapp

Privat app for oppgaver og notater – en blanding av Todoist og Notion. Fungerer på PC og mobil (PWA).

## Funksjoner

- **Hurtiglegging på norsk**: «Ring tannlegen fredag kl 14 #helse p1» tolkes til dato, klokkeslett, prosjekt og prioritet
- **Visninger**: Innboks, I dag (med forfalte), Kommende (to uker) og prosjekter
- **Sider** med blokkeditor: overskrifter, sjekklister, punktlister og sitater, «/»-meny og markdown-snarveier
- **Søk og kommandopalett**: `Ctrl/⌘ + K`
- **Hurtigtast** `Q` for ny oppgave
- Lys/mørk modus

Data lagres foreløpig lokalt i nettleseren. Synk mellom enheter (Supabase) kommer.

## Utvikling

```bash
npm install
npm run dev      # starter på http://localhost:5173
npm run build    # bygger til dist/
```

Teknologi: Vite, React, TypeScript, Tailwind CSS.
