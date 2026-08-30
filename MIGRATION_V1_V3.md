# Migration V1 to V3

## 1. Non-negotiable rule

V1 stays online and unchanged until a V3 slice has passed data reconciliation,
authorization tests, user acceptance, and rollback rehearsal. The V3 branch does
not deploy over the GitHub Pages production site.

## 2. Current V1 evidence

The audit found a static application with approximately 142 HTML pages, 22
JavaScript files, and 14 stylesheets. Several files exceed 1,300 lines, including
the student dashboard, admin page, authentication script, registry, and surah
pages. Business concepts are stored across browser state and broad Supabase
tables. The `messages` table currently carries unrelated records through text
prefixes such as teacher notes, admin reports, sessions, remote classes, finance,
and virtual recitations.

Existing production data includes concepts represented by tables such as
`eleves`, `profs`, `profils_admin`, `progressions`, `devoirs`, `horaires`,
`messages`, `parent_feedback`, `school_classes`, `class_students`,
`school_messages`, `student_admin_profiles`, and `admin_audit_logs`.

This inventory must be confirmed against a read-only export before writing final
transformations. The codebase is evidence, not an authoritative database schema.

## 3. Migration sequence

### Phase 0: Foundation (this branch)

- Isolate V3 under `/v3`.
- Establish strict TypeScript, CI, tests, Supabase SSR, RBAC, and RLS conventions.
- Document domain boundaries and security invariants.
- Make no production data or routing change.

### Phase 1: Read-only discovery

- Export schema, policies, row counts, null rates, duplicates, and orphan rows.
- Create a stable V1 identifier map for every student, parent, teacher, and class.
- Classify overloaded message prefixes into explicit target domains.
- Record checksums and totals so every later import can be reconciled.

### Phase 2: Identity and people

- Provision Auth identities without changing V1 login behavior.
- Import profiles, roles, parent-child links, teacher-class links, and status.
- Test student, parent, teacher, admin, suspended, and multi-role access.
- Run V3 read-only beside V1 for selected internal users.

#### Secure V1 account procedure

1. Export V1 accounts read-only into an encrypted, access-controlled workspace.
2. Normalize stable legacy IDs and login identifiers; never match by display name.
3. Produce an HMAC fingerprint for reconciliation and duplicate detection.
4. Drop every V1 password, reversible password, hash of unknown quality, and
   hardcoded administrative credential from the import artifact.
5. Create a fresh Supabase Auth identity with a new temporary secret.
6. Call `provision_account_data` to create profile, role, school membership,
   private alias, and audit event in one database transaction.
7. Keep the account `pending` until row counts and relationships reconcile.
8. Require a fresh password path before broad activation; do not reactivate V1
   credentials in V3.

`npm run migration:v1:prepare -- input.json output.json` creates a password-free
reconciliation artifact. It requires `V1_MIGRATION_FINGERPRINT_KEY` and never
writes the normalized raw login identifier to the artifact.

### Phase 3: Academic core

- Migrate schools, classes, enrolments, schedules, attendance, and sessions.
- Keep V1 as the writer while V3 builds reconciled read models.
- Introduce idempotent dual-write only after replay and rollback tests.

### Phase 4: Quran learning and assignments

- Normalize surahs, ayahs, readings, exercises, attempts, progress, and homework.
- Preserve every historical completion and teacher recitation with source IDs.
- Compare student totals, unlocked steps, stars, and completion dates per account.

### Phase 5: Messaging, requests, finance, and notifications

- Split the overloaded `messages` records into typed entities.
- Import parent feedback and reports with their original timestamps and status.
- Rebuild finance as an auditable ledger; never infer balances from UI text.
- Add an outbox before enabling push or offline synchronization.

### Phase 6: Cutover by role

- Pilot staff first, then teachers, parents, and students class by class.
- Freeze the migrated V1 slice briefly, replay the final delta, and reconcile.
- Switch a feature flag, monitor errors and data totals, retain a tested rollback.
- Retire V1 pages only after the agreed observation period.

## 4. Data preservation controls

- All imports carry `legacy_source`, `legacy_id`, and migration batch metadata.
- Migrations are idempotent and never match people by display name alone.
- Every batch records source count, inserted count, updated count, rejected count,
  and a hash or aggregate suitable for reconciliation.
- Rejected rows go to a quarantine report; they are never silently discarded.
- Production backup and restore rehearsal precede the first write migration.
- Renaming a person or changing credentials never creates a new learner identity.

## 5. Rollback model

Before a slice becomes authoritative, rollback means disabling the V3 feature flag
and returning traffic to V1. Once V3 becomes the writer, compensating migrations
and an event/outbox replay are required; direct database reversal is not assumed.

## 6. Definition of migrated

A slice is migrated only when its schema, policies, import, reconciliation,
automated tests, mobile journey, observability, operator procedure, and rollback
have all been demonstrated. Visual similarity alone is not migration completion.
