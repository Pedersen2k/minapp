-- Etiketter på oppgaver og manuell rekkefølge (dra og slipp).
-- Kjør i Supabase → SQL Editor → New query → Run.
alter table public.tasks
  add column if not exists labels text[] not null default '{}',
  add column if not exists position double precision;
alter table public.projects add column if not exists position double precision;
alter table public.pages add column if not exists position double precision;
