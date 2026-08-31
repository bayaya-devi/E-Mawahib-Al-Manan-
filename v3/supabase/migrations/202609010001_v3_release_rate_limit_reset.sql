-- One-time release cleanup after automated authentication smoke tests.
delete from private.auth_rate_limits;
