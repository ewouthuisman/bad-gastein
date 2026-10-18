-- Live lift status every 15 minutes (the function only works during lift hours).
select cron.schedule('lift-status', '*/15 * * * *', $$ select private.call_function('lift-status') $$);
