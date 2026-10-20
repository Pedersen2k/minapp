-- Innstillinger per bruker (f.eks. tilkobling til Gmail-skriptet og værsted).
-- Kjør i Supabase → SQL Editor → New query → Run.
create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists "Egne innstillinger" on public.settings;
create policy "Egne innstillinger" on public.settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
