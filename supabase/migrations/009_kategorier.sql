-- Kategorier (seksjoner) inne i prosjekter.
-- Kjør i Supabase → SQL Editor → New query → Run.
alter table public.projects add column if not exists sections jsonb not null default '[]';
alter table public.tasks add column if not exists section_id text;
