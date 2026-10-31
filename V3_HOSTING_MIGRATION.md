# V3 hosting migration

V3 runs as a dynamic Next.js application on Vercel. Supabase project `mdgofogpghlwesaduxrq` remains the data and authentication authority. GitHub Pages serves only the static compatibility redirect in `legacy-redirect`.

Production URL: `https://e-mawahib-al-manan.vercel.app`

Rollback: restore the previous GitHub Pages workflow artifact and keep the additive V3 tables. Never delete V3 data during a routing rollback.
