# Domain boundaries

Each feature owns its domain language, use cases, infrastructure adapters, and UI.
Features may import shared primitives from `src/lib` and `src/types`; they must not
reach into another feature's internal files. Cross-domain work is coordinated by
explicit application services added in a later migration slice.

Initial domains:

- `identity`: accounts, authentication, roles, guardianship.
- `academics`: schools, classes, enrolments, calendars.
- `quran`: surahs, ayahs, readings, learning progress.
- `sessions`: in-person, remote, and guided teaching sessions.
- `attendance`: attendance facts and corrections.
- `assignments`: homework lifecycle and assessment.
- `messaging`: scoped conversations and school announcements.
- `requests`: reports, parent feedback, and administrative workflows.
- `people`: student, parent, teacher, and staff records.
- `finance`: fees, payments, expenses, and immutable ledger entries.
- `content`: platform-managed educational content.
- `notifications`: delivery preferences, outbox, and delivery receipts.
- `analytics`: read models and privacy-aware reporting.
- `offline`: local commands, conflict resolution, and synchronization.
