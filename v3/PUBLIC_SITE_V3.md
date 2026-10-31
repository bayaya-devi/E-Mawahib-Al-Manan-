# Public Site V3

## Routes and locales

The public site lives under `/{locale}` with `ar`, `fr`, `en`, and `amz`. Arabic is RTL. French, English, and Tachelhit in Tifinagh are LTR. The language switch preserves the current page.

Pages: home, presentation, programs, schedule, courses, registration, news, replays, FAQ, and contact. `/` redirects to `/ar`.

## Source of truth

`public_site_profiles` stores central contact and registration data. `public_schedules` is the shared schedule source for the public site and the authenticated application. News and replays use parent records plus one translation row per locale.

Publication states are `draft`, `published`, and `archived`. Anonymous users only read published records whose publication date has arrived. Active administrators and direction users can inspect all states for their school.

## Administration

`/admin/site` manages central site data, schedules, multilingual news, and multilingual replays. Every mutation is authenticated on the server and limited to an active `admin` or `direction` membership. The service-role key never reaches the browser.

Content is archived rather than physically deleted so publication history is retained.

## Likes and views

The browser receives a random, HTTP-only, same-site visitor cookie. The server combines it with coarse request characteristics and stores only HMAC-SHA256 fingerprints. It never stores the raw cookie, IP address, or user agent. Likes are unique per visitor and rate-limited per coarse network fingerprint and day. Views are counted once per visitor and replay per day.

`INTERACTION_HMAC_KEY` must be a random deployment secret of at least 32 characters and must remain stable between deployments.

This mechanism is intentionally privacy-conscious and reasonably resistant to ordinary repeated clicks. It is not intended to defeat a distributed botnet; edge rate limiting can be added later without changing the data model.

## Validation

Database tests cover RLS, draft visibility, like toggling, rate limiting, and view deduplication. Playwright covers locale switching, shared schedules, multilingual news publication, multilingual replay publication, and likes on desktop, tablet, and mobile.
