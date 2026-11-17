-- Beskrivelse, start, frist, festing og arkivering for prosjekter.
-- Kjør i Supabase → SQL Editor → New query → Run.
alter table public.projects add column if not exists description text;
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists deadline date;
alter table public.projects add column if not exists pinned boolean not null default false;
alter table public.projects add column if not exists archived boolean not null default false;
