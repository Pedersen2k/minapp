# Helse fra iPhone til «Min dag»

Apple Helse har ingen web-API, så dataene må sendes fra iPhonen. En Snarvei (appen
Snarveier) leser fra Helse og sender tallene til Edge Function `health-ingest`, som lagrer
én rad per dag. Kortet **Helse** på «Min dag» viser dem.

## 1. Sett opp Supabase (én gang)

1. Kjør `supabase/migrations/010_helse.sql` i SQL Editor.
2. Edge Functions → Secrets: legg til `HEALTH_KEY` (en lang tilfeldig streng) og
   `HEALTH_USER_ID` (din bruker-id, se Authentication → Users). Verdiene skal aldri i repoet.
3. Deploy funksjonen uten JWT-sjekk (snarveien har ikke innlogging, den bruker nøkkelen):
   `supabase functions deploy health-ingest --no-verify-jwt`

## 2. Lag snarveien på iPhonen

Ny snarvei, med disse handlingene:

1. **Finn helseprøver** → Type: *Skritt*, Startdato: *er i dag*, Grupper etter: *Dag* …
   Velg **Beregn statistikk** → *Sum*. Gjenta for hver verdi du vil ha:

   | JSON-felt      | Helse-type              | Statistikk |
   |----------------|-------------------------|------------|
   | `steps`        | Skritt                  | Sum        |
   | `active_kcal`  | Aktiv energi            | Sum        |
   | `exercise_min` | Treningsminutter        | Sum        |
   | `distance_km`  | Gå- og løpedistanse     | Sum        |
   | `sleep_h`      | Søvn (varighet, timer)  | Sum        |
   | `resting_hr`   | Hvilepuls               | Siste      |
   | `weight_kg`    | Kroppsvekt              | Siste      |

2. **Hent innholdet i URL** (POST):
   - URL: `https://<prosjekt>.supabase.co/functions/v1/health-ingest`
   - Metode: *POST*
   - Hoder: `x-health-key` = nøkkelen din
   - Forespørselstekst: *JSON* med feltene over, f.eks. `steps` = variabelen fra steg 1.
   - `day` kan utelates (da brukes dagens dato). Alle felt er valgfrie, og bare de du
     sender oppdateres, så du kan ha én snarvei for søvn om morgenen og en annen for resten.

## 3. Kjør automatisk

Snarveier → **Automatisering** → *Tid på døgnet* (f.eks. 08:00, 13:00 og 21:00) → kjør
snarveien, og slå av «Spør før kjøring». Da holder kortet seg oppdatert uten at du gjør noe.

## Test

```bash
curl -X POST https://<prosjekt>.supabase.co/functions/v1/health-ingest \
  -H 'x-health-key: <HEALTH_KEY>' -H 'Content-Type: application/json' \
  -d '{"steps": 8421, "active_kcal": 512, "sleep_h": 7.4}'
```
