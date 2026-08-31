-- Clear only stale authentication counters after correcting the production service role.
delete from private.auth_rate_limits;
