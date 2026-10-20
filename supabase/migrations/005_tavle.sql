-- Kanban-tavle: kolonner og visningsvalg per prosjekt, kolonne per oppgave.
-- Kjør i Supabase → SQL Editor → New query → Run.
alter table public.projects
  add column if not exists view text,
  add column if not exists columns jsonb not null default '[]';
alter table public.tasks add column if not exists column_id text;
