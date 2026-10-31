# Design System V3

## Identity

The V3 interface is Arabic-first and RTL-native. It uses warm neutral surfaces,
deep institutional green, graphite text, restrained matte gold, and burgundy only
for exceptional emphasis. It avoids ornamental religious motifs, generic SaaS
dashboard composition, gradients, and decorative clutter.

## Typography

- Display and navigation: Noto Kufi Arabic Variable.
- Body, fields, tables, and long text: Noto Sans Arabic Variable.
- Both fonts are self-hosted through npm packages; rendering does not depend on a
  third-party font request.

## Foundations

Tokens live in `v3/src/app/globals.css`. Components and shell rules live in
`v3/src/styles/design-system.css`. Components consume semantic tokens rather than
hard-coded role-specific palettes. Cards use a maximum radius of 8px.

## Components

The reference implementation is available at `/design-system`. It includes
buttons, icon buttons, fields, native selects, cards, dialogs, drawers, tables,
badges, avatars, toasts, skeletons, empty states, and error states. Radix Dialog
provides focus management and keyboard dismissal for overlays.

## Shells

- `/`: public shell with compact responsive header.
- `/student`: student navigation and workspace.
- `/family`: family navigation and workspace.
- `/teacher`: teacher navigation and workspace.
- `/admin`: administration navigation and workspace.

Application shells use an RTL side rail on desktop and a safe-area-aware bottom
navigation on mobile. Global navigation search opens with `Ctrl+K` or `Cmd+K`.
Content areas render explicit empty states until authenticated data exists; no
permanent fictitious business records are embedded in the UI.

## Accessibility and motion

All interactive controls have visible focus, 44px minimum touch targets, Arabic
labels, keyboard access, and reduced-motion behavior. Automated Playwright tests
cover desktop, tablet, and mobile layouts, RTL direction, horizontal overflow,
command search, focus trapping, and Escape dismissal.
