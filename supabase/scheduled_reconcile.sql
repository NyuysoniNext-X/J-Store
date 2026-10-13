-- Run once after enabling pg_cron, pg_net, and Vault, and storing the same
-- random secret in Vault as `payments_cron_secret` and in the Edge Function
-- environment as `CRON_SECRET`.
select cron.unschedule(jobid)
from cron.job
where jobname = 'payments-reconcile';

select cron.schedule(
  'payments-reconcile',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := 'https://fnbwgnrzijwzouqluaum.supabase.co/functions/v1/payments/reconcile',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'payments_cron_secret'
          limit 1
        )
      ),
      body := '{}'::jsonb
    );
  $job$
);
