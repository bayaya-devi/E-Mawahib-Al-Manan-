# Architecture V3

## 1. Purpose

V3 is a new application built beside V1. It establishes a maintainable and secure
foundation before any business feature is migrated. V1 remains the production
application and is not imported into the V3 runtime.

The first architectural decision is therefore simple: V3 lives in `/v3` on branch
`codex/v3-foundation`, and migration happens in reversible functional slices
rather than through a big-bang rewrite.

## 2. Technology baseline

- Next.js 16 App Router, React 19, TypeScript in strict mode.
- Supabase Auth, PostgreSQL, Row Level Security, and generated database types.
- Zod at every untrusted runtime boundary.
- Tailwind CSS for tokens and primitives; feature UI stays owned by its domain.
- Vitest for unit/component tests and Playwright for browser journeys.
- Node 22 as the CI and deployment baseline.

Webpack is selected explicitly for `dev` and `build`. The current Windows host
rejects Next's native SWC binary and Turbopack cannot run on the WASM fallback;
Webpack supports that fallback and preserves the same application architecture.

## 3. Repository layout

```text
v3/
  src/app/                 routes, layouts, error/loading boundaries
  src/features/            business domains
  src/lib/auth/            authorization primitives
  src/lib/env/             validated runtime configuration
  src/lib/supabase/        browser/server/proxy adapters
  src/lib/errors/          shared result and error primitives
  src/types/               domain and generated database types
  supabase/migrations/     forward-only database changes
  supabase/tests/          SQL security invariants
  tests/e2e/               cross-domain browser journeys
```

Each feature will evolve internally through `domain`, `application`,
`infrastructure`, and `ui` folders when its first use case is migrated. A feature
may use `src/lib` and `src/types`; direct imports from another feature's internal
files are forbidden. Cross-domain workflows use explicit application services.

## 4. Domain boundaries

| Domain | Owns |
| --- | --- |
| identity | Authentication, roles, account lifecycle, guardianship |
| people | Student, parent, teacher, and staff records |
| academics | Schools, classes, enrolments, calendars |
| quran | Surahs, ayahs, readings, learning progress |
| sessions | In-person, guided, and remote teaching sessions |
| attendance | Attendance facts and justified corrections |
| assignments | Homework creation, delivery, completion, assessment |
| messaging | Conversations, messages, and announcements |
| requests | Reports, parent feedback, administrative workflows |
| finance | Fees, payments, expenses, immutable ledger entries |
| notifications | Preferences, outbox, delivery attempts and receipts |
| analytics | Privacy-aware read models, not source-of-truth writes |
| offline | Local commands, idempotency, conflicts, synchronization |
| content | Managed educational and help content |

## 5. Request and data flow

1. The Next.js proxy refreshes the Supabase cookie session.
2. Server code validates the authenticated user with Supabase Auth.
3. The application use case checks the required capability.
4. Input is parsed at runtime before reaching domain logic.
5. PostgreSQL RLS independently restricts every query to its permitted scope.
6. Sensitive mutations run in trusted server code and append an audit event.
7. UI receives typed results and never relies on hidden controls for security.

Authorization is deliberately duplicated at application and database levels.
Application checks provide useful errors; RLS remains the final security barrier.

## 6. Identity model

An Auth user has one profile and one or more explicit roles. Roles are data, not
client metadata. Clients may read permitted role rows but cannot create, update,
or delete them. Role provisioning will be implemented as a trusted server use
case with an audit event in the next identity slice.

The initial capability matrix is intentionally small. It will expand through
reviewed use cases rather than broad labels such as "admin can do everything".

## 7. Environments

| Environment | Purpose | Data rule |
| --- | --- | --- |
| development | Local Supabase and developer iteration | Synthetic data only |
| test | CI, unit, integration, and browser tests | Disposable fixtures |
| production | Real users | Forward migrations, backups, auditability |

Examples are committed as `.env.*.example`; real `.env` files remain ignored.
Public variables contain only the Supabase URL and publishable anonymous key.
Privileged keys must stay in server secret storage and are not part of this
frontend foundation.

## 8. Quality gates

`npm run check` executes lint, strict typecheck, unit tests, and production build.
The GitHub workflow repeats these gates on V3 changes. Browser tests use the
installed stable Chrome channel and run separately with `npm run test:e2e`.

## 9. Decisions deferred on purpose

- No V1 screen or feature has been copied yet.
- No production Supabase project is linked to V3.
- No V1 data has been transformed.
- Offline conflict rules will be designed per command, not guessed globally.
- PWA caching starts only after authentication and data-sensitivity rules exist.
- Observability vendor selection remains open; structured audit events are ready.

These are migration tasks, not omissions hidden behind the foundation label.
