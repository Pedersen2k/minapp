-- Påminnelser: varslingstidspunkt per oppgave og varslingsabonnement per enhet.
-- Kjør i Supabase → SQL Editor → New query → Run.
alter table public.tasks
  add column if not exists reminder integer,
  add column if not exists remind_at timestamptz,
  add column if not exists reminded_at timestamptz;

create index if not exists tasks_remind_idx on public.tasks (remind_at) where done = false;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Egne varslingsabonnement" on public.push_subscriptions;
create policy "Egne varslingsabonnement" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
