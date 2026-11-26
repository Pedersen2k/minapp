-- Jobb eller privat for prosjekter. Brukes av kontrollvisningen i «Min dag».
-- Oppgaver arver fra prosjektet sitt, underprosjekter fra hovedprosjektet.
-- Kjør i Supabase → SQL Editor → New query → Run.
alter table public.projects add column if not exists context text check (context in ('jobb', 'privat'));
