# Security V3

## 1. Security objectives

V3 handles children, families, teaching records, voice-related learning data, and
financial information. Confidentiality, data integrity, least privilege, and a
traceable administrative history are baseline requirements.

## 2. Trust boundaries

- Browser and installed PWA are untrusted clients.
- Next.js server code is trusted only after authentication and input validation.
- Supabase Auth establishes identity; PostgreSQL RLS enforces row scope.
- Third-party audio, notification, video, and AI services are separate processors
  and require explicit review before receiving user data.
- V1 data is untrusted migration input, even when it came from the same school.

## 3. Authentication

- Supabase SSR uses secure cookie sessions and PKCE-compatible flows.
- Server authorization uses `auth.getUser()`; cached client claims are not enough
  for a sensitive decision.
- Login failures remain generic to reduce account enumeration.
- Signup is disabled in the base config; account creation is an audited admin flow.
- Password reset, MFA for privileged users, session revocation, and rate limits
  must be completed before production identity cutover.

## 4. Authorization and RLS

- Roles are stored in `user_roles`, never trusted from browser state, localStorage,
  sessionStorage, or editable Auth user metadata.
- Clients cannot insert, update, or delete roles, profiles, or audit logs.
- Every table must enable RLS in the migration that creates it.
- A new table without explicit policies fails review and SQL security tests.
- Application capabilities improve UX but never replace database policies.
- Service-role credentials are forbidden in `NEXT_PUBLIC_*` variables and client
  bundles. Privileged operations live in trusted server code.

The identity and school migrations provide scoped reads only. Client mutation
policies remain withheld. Account creation and status changes are server-only
transactions that independently validate the acting administrator and append an
audit event. This is intentional deny-by-default behavior.

## 5. Input, output, and files

- Parse route, form, webhook, and migration inputs with explicit schemas.
- React escaping remains enabled; raw HTML requires sanitization and review.
- Database queries use Supabase/PostgREST parameters, never SQL concatenation.
- Message uploads use a MIME allowlist, a 10 MB limit, generated object names,
  SHA-256 checksums, a private bucket, relationship checks, and 60-second signed
  download URLs. A malware scanning service remains a production infrastructure
  option for higher-risk document categories.

## 6. Secrets and environments

- Real `.env` files and keys are ignored by Git.
- Development, test, and production use separate projects and credentials.
- Secret values live in the deployment secret store and are rotated after staff
  changes or suspected exposure.
- Logs never contain passwords, tokens, full child records, or raw recitation audio.

## 7. Audit and observability

Privileged identity mutations append immutable records containing actor, action,
target, timestamp, request ID, and minimal metadata. Audit logs are not editable
through the client. Operational logs use structured error codes and redact user
content. Alerts are required for repeated login failures, role changes, bulk
exports, unusual finance changes, and policy denials.

## 8. Child and privacy safeguards

- Collect only data required for teaching or school administration.
- Separate guardian access from student access and model explicit relationships.
- Do not expose class rankings, identity, or voice data outside authorized scopes.
- Define retention and deletion rules per data category before importing history.
- AI assessment must be optional, explainable, human-reviewable, and must not send
  recordings to a provider before consent and processor review.

The learning schema enforces these boundaries through `can_access_student`:

- a student reads only rows whose `student_id` is their Auth user ID;
- a parent reads every actively linked child and no unlinked child;
- a teacher reads only students actively enrolled in an assigned class;
- administration is constrained by school membership, while direction is global;
- Quran reference tables are read-only to clients;
- assignment correction, canonical Quran writes, and V1 imports are never direct
  browser table writes;
- acoustic tajwid is stored only as `not_evaluated` in this release.

## 9. Offline security

- Cache the minimum needed for the signed-in user, never whole-class directories.
- Encrypt sensitive local storage where platform capabilities permit it.
- Queue commands with idempotency keys and validate authorization again on sync.
- Server truth wins for roles, account state, finance, and administrative actions.
- Logout and account suspension clear or render cached private data inaccessible.

## 10. Required checks before production

- RLS tests for every role, relationship, suspended account, and cross-class read.
- Dependency and secret scanning in CI.
- Rate limiting and abuse tests on authentication and write endpoints.
- Backup restoration, migration rollback, and audit-log integrity rehearsal.
- Browser security headers and CSP tuned to actual audio/video integrations.
- Independent review of the first complete identity and people migration slice.

## 11. Known gaps

MFA TOTP is enforced for admin/direction routes and login, message, and public
interaction limits exist in the database. Production still requires a staging
rehearsal, verified MFA recovery, real Storage/Realtime smoke tests, and a full V1
migration reconciliation. Closed-app Web Push requires a VAPID delivery worker;
the current browser notification path is Realtime-driven while the application is
active. Browser ASR still depends on device support and never fabricates a score.
