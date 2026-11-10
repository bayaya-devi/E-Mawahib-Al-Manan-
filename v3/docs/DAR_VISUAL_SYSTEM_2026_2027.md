# DAR Visual System 2026-2027

This document describes the shared presentation layer used by the public site and the authenticated administration, teacher, family, and student spaces. It does not change business rules, API contracts, permissions, or persisted data.

## Foundations

- Official colors: champagne `#B88646`, coffee `#241C18`, silver `#C8C8C5`, ivory `#F8F6F2`, white `#FFFFFF`, and night `#171719`.
- Typography: Noto Sans Arabic Variable for body copy and Noto Kufi Arabic Variable for display text. Both support Arabic and Latin interfaces without loading another font family.
- Spacing: a 4px-based scale exposed through `--space-*` tokens.
- Corners: compact 6-8px surfaces, with a larger floating radius reserved for navigation, dialogs, and contextual panels.
- Motion: 160-220ms transitions. Non-essential motion is removed when `prefers-reduced-motion` is enabled.
- Glass: translucent surfaces are limited to navigation, dialogs, toasts, and floating controls. Opaque fallbacks are provided for reduced transparency and unsupported browsers.

## Shared Components

The existing UI primitives remain the single component library:

- `Button`: primary, secondary, quiet, destructive, disabled, and loading states.
- `Input` and `Select`: visible labels, hints, errors, focus rings, and 44px minimum targets.
- `Card`, `Badge`, `Avatar`, and state components: consistent hierarchy and semantic colors.
- `Dialog`, `Drawer`, `Toast`, and `CommandPalette`: focus-managed floating surfaces with responsive layouts.
- `AppShell` and `PublicShell`: one adaptive navigation model for desktop, tablet, mobile, RTL, and LTR.

## Responsive Navigation

- Desktop: a right-side rail for authenticated spaces, visible by default and collapsible without leaving an empty column.
- Tablet: a compact icon rail with accessible names and tooltips.
- Mobile: a five-destination bottom navigation with safe-area spacing; secondary destinations remain available in a drawer.
- Public site: full navigation when space permits, then an accessible menu that keeps language and login controls visible.

## Student Age Variants

The interface uses the existing age category only as a visual variant:

- Child: larger touch targets, stronger labels, shorter headings, and clearer card boundaries.
- Teen: standard density with contemporary navigation and visible progress.
- Adult: quieter surfaces, reduced decoration, and compact information density.
- Unknown: neutral presentation. No permission or learning rule depends on the visual stage.

## Themes And Languages

- Light, dark, and system appearance use the same semantic tokens.
- Existing saved preferences retain priority over the system setting.
- Arabic uses RTL; French and other public locales use LTR at both application and document level.
- Numbers use tabular figures for stable financial and statistical alignment.

## Page Inventory

- Public: home, presentation, programs, schedule, courses, registration, news, replays, FAQ, contact, legal pages, consent, and public navigation.
- Authentication: login, errors, suspended access, loading, and public return action.
- Administration: dashboard, teachers, students, classes, parents, finance, communication, monitoring, site management, settings, system, resources, operations, workforce, governance, and person details.
- Teacher: dashboard, students, session mode, reports, professional file, messages, and settings.
- Student: dashboard, Quran path and detail, juz, assignments, games, follow-up, history, parents, profile, messages, and settings.
- Family: dashboard, messages, and settings.

## Accessibility And Performance

- Minimum touch targets are 44px, focus remains visible, and active states do not rely on color alone.
- The public document language and direction follow the selected locale.
- Mobile layouts avoid horizontal overflow at 320px and preserve access to every destination.
- Backdrop blur is bounded and disabled when reduced transparency is requested.
- The official logo is reused unchanged from `/public/dar-al-hadith/logo.webp`.
