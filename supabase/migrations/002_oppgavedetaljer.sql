-- Beskrivelse, gjentakelse og underoppgaver på oppgaver.
-- Kjør i Supabase → SQL Editor → New query → Run.
alter table public.tasks
  add column if not exists notes text,
  add column if not exists recurrence text
    check (recurrence in ('daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'yearly')),
  add column if not exists subtasks jsonb not null default '[]';
