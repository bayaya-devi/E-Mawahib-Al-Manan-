# Legacy redirect audit

- The artifact contains no V1 application code or credentials.
- Known role routes have deterministic destinations.
- Unknown paths are mapped without accepting an external redirect target.
- Legacy service workers are unregistered.
- Only cache names beginning with `mawahib-` are removed.
- A plain link and meta refresh remain available if JavaScript is disabled.
