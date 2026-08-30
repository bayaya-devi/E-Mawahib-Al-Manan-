# E-Mawahib Al-Manan V3

This directory is the isolated V3 application. The current V1 remains outside
this directory and is not modified or bundled by V3.

## Local setup

```bash
cp .env.development.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the complete quality gate with `npm run check`. Browser journeys use
`npm run test:e2e` after Playwright browsers have been installed.

Architecture, migration, and security decisions are documented at repository root
in `ARCHITECTURE_V3.md`, `MIGRATION_V1_V3.md`, and `SECURITY_V3.md`.
