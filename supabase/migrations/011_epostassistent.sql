-- E-postassistenten: husker hvilke e-poster som er gått gjennom, så de ikke behandles to ganger.
-- Skrives av Edge Function mail-agent (med service-nøkkelen). Kjør i Supabase → SQL Editor → Run.
create table if not exists public.mail_agent_seen (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  message_id text not null,
  processed_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

alter table public.mail_agent_seen enable row level security;

drop policy if exists "Egne behandlede e-poster" on public.mail_agent_seen;
create policy "Egne behandlede e-poster" on public.mail_agent_seen for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
