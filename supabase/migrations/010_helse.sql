-- Helsedata fra iPhone (Apple Helse) til «Min dag»-kortet Helse.
-- Skrives av Edge Function health-ingest (som bruker service-nøkkelen), leses av appen.
-- Kjør i Supabase → SQL Editor → New query → Run.
create table if not exists public.health_days (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  steps integer,
  active_kcal integer,
  exercise_min integer,
  distance_km numeric(6,2),
  sleep_h numeric(4,2),
  resting_hr integer,
  weight_kg numeric(5,1),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.health_days enable row level security;

-- Appen trenger bare å lese. Innsetting skjer fra Edge Function, ikke fra nettleseren.
drop policy if exists "Egne helsedata" on public.health_days;
create policy "Egne helsedata" on public.health_days for select to authenticated
  using (user_id = (select auth.uid()));
