-- Papirkurv for sider: slettede sider får et tidspunkt og slettes for godt etter 30 dager (i appen).
-- Kjør i Supabase → SQL Editor → New query → Run.
alter table public.pages add column if not exists deleted_at timestamptz;
