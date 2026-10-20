-- Underprosjekter: et prosjekt kan ligge under et annet.
-- Kjør i Supabase → SQL Editor → New query → Run.
alter table public.projects
  add column if not exists parent_id uuid references public.projects on delete cascade;
