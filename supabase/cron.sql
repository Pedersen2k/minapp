-- Planlagt jobb som kaller send-reminders hvert minutt.
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
