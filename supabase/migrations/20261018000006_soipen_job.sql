-- Soipie's Soipen commentary every 30 minutes (the function skips the night itself).
select cron.schedule('soipen-comment', '*/30 * * * *', $$ select private.call_function('soipen-comment') $$);
