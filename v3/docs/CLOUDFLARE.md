# Cloudflare production perimeter

Cloudflare complements the current architecture. It does not replace Vercel or Supabase:

- Vercel serves Next.js and the server API routes.
- Supabase remains the sole source of truth for authentication, RLS, realtime, and data.
- Cloudflare provides DNS, TLS, CDN for public content, WAF, rate limiting, and Turnstile.

## Required dashboard setup

1. Add the production domain to Cloudflare and change only the domain registrar nameservers to those supplied by Cloudflare.
2. In Vercel, add the same custom domain to the `e-mawahib-al-manan` project. Keep the Vercel DNS validation record exactly as Vercel requests.
3. In Cloudflare DNS, create the Vercel-directed CNAME record for `www` and the root-domain record recommended by Vercel. Enable the orange proxy only after Vercel confirms that the domain is valid.
4. Set SSL/TLS encryption mode to `Full (strict)`, enable Always Use HTTPS, TLS 1.2 minimum, and DNSSEC when the registrar supports it.
5. Create a Turnstile managed widget for the production hostname and add these Vercel Production environment variables:

   ```text
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key>
   TURNSTILE_SECRET_KEY=<secret key>
   ```

   Redeploy after both are saved. The login remains available before this step because Turnstile is deliberately opt-in until valid keys exist.

## Cache policy

Cloudflare may cache only public, anonymous material:

- `/_next/static/*`
- public images, fonts, and media assets
- public pages such as `/ar`, `/fr`, `/en`, `/zgh`, and public articles/replays when they do not include user data

Create explicit **Bypass cache** rules for:

```text
/api/*
/admin*
/student*
/teacher*
/family*
/login*
/auth/*
/offline/*
/sw.js
```

Do not use Cache Everything globally. Never cache responses carrying session cookies or Supabase credentials.

## WAF and rate limiting

Start in simulated/logging mode for 24 hours, then enable the rules after confirming legitimate traffic is unaffected:

- managed WAF rules enabled;
- rate limit `POST /api/auth/login` by client IP;
- rate limit public write endpoints such as replay likes, contact, registration, and survey submission;
- allow Supabase webhooks and Vercel deployment traffic where needed;
- do not challenge authenticated application navigation paths.

The application also keeps its own server-side login rate limit. Cloudflare is an additional perimeter, not its replacement.

## Safeguards

- `TURNSTILE_SECRET_KEY` is server-only and must be stored only in Vercel, never in Git or a browser variable.
- Turnstile tokens are validated server-side at login.
- No Cloudflare Worker, D1, KV, or R2 bucket is required for the present production application.
- Reconsider R2 only for large public media after a separate migration plan; do not move student/private documents automatically.

## Verification after activation

1. Confirm the custom domain is `Ready` in Vercel.
2. Confirm the site loads through Cloudflare over HTTPS.
3. Log in as student, teacher, and administrator.
4. Confirm a protected page is never served from cache after changing data.
5. Confirm a failed Turnstile token blocks login and a valid token permits the normal login flow.
6. Check Cloudflare Security Events before enforcing stricter rules.
