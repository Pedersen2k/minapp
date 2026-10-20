-- Minapp: databaseoppsett for Supabase.
-- Kjør hele filen én gang i Supabase → SQL Editor → New query → Run.

create table if not exists public.projects (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text not null,
  parent_id uuid references public.projects on delete cascade,
  position double precision,
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  done boolean not null default false,
  due date,
  time text,
  priority smallint not null default 4,
  project_id uuid references public.projects on delete cascade,
  notes text,
  recurrence text check (recurrence in ('daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'yearly')),
  subtasks jsonb not null default '[]',
  labels text[] not null default '{}',
  position double precision,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.pages (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null default '',
  icon text not null default '📄',
  blocks jsonb not null default '[]',
  position double precision,
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_idx on public.tasks (user_id);
create index if not exists tasks_project_idx on public.tasks (project_id);
create index if not exists projects_user_idx on public.projects (user_id);
create index if not exists pages_user_idx on public.pages (user_id);

-- Radnivåsikkerhet: hver bruker ser og endrer bare sine egne rader.
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.pages enable row level security;

drop policy if exists "Egne prosjekter" on public.projects;
create policy "Egne prosjekter" on public.projects for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Egne oppgaver" on public.tasks;
create policy "Egne oppgaver" on public.tasks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Egne sider" on public.pages;
create policy "Egne sider" on public.pages for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Sanntid: endringer på én enhet dukker opp på de andre med en gang.
alter publication supabase_realtime add table public.projects, public.tasks, public.pages;
