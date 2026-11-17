-- Planlagte jobber: send-reminders hvert minutt og kaskjerda-tilsyn hvert 15. minutt.
-- Bytt ut <CRON_SECRET> med samme verdi som hemmeligheten CRON_SECRET i Edge Functions,
-- og kjør i Supabase → SQL Editor. Ikke lagre den ekte verdien i dette repoet.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('send-reminders') where exists (select 1 from cron.job where jobname = 'send-reminders');

select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://vzdhjlzqaujefhmqrgnr.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);

-- Gjør varsler om tilsyn på kaskjerda.no (GitHub-issues) til oppgaver, hvert 15. minutt.
-- Bruker samme CRON_SECRET som over.
select cron.unschedule('kaskjerda-tilsyn') where exists (select 1 from cron.job where jobname = 'kaskjerda-tilsyn');

select cron.schedule(
  'kaskjerda-tilsyn',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://vzdhjlzqaujefhmqrgnr.supabase.co/functions/v1/kaskjerda-tilsyn',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
