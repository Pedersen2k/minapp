-- Ikon på prosjekter og egne innstillinger (farge) for etiketter.
-- Kjør i Supabase → SQL Editor → New query → Run.
alter table public.projects add column if not exists icon text;

create table if not exists public.labels (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.labels enable row level security;

drop policy if exists "Egne etiketter" on public.labels;
create policy "Egne etiketter" on public.labels for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.labels;
