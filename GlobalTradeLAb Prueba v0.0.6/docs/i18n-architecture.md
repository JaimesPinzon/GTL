# i18n Architecture

This project uses a semantic i18n structure designed to scale beyond `es` and `en`.

## Current principles

- All user-facing UI text should live in translation resources.
- Keys should be semantic and domain-based, not phrase-based.
- Both `es` and `en` must keep the same structure.
- Dynamic content must use interpolation instead of string concatenation.
- Shared actions and labels should reuse `common.*` only when the meaning is truly the same.

## Active translation domains

- `common`
- `app`
- `navigation`
- `auth`
- `trading`
- `settings`
- `landing`
- `learn`
- `help`
- `classes`
- `alertOverlay`
- `marketSearch`
- `priceChart`
- `teacher`
- `studentPortfolio`

## File responsibilities

- `src/Languages/i18n.jsx`
  Initializes i18n, detection, fallback language, and supported locales.
- `src/Languages/es.js`
  Spanish source of truth for structure changes.
- `src/Languages/en.js`
  English mirror with the exact same key tree.
- `src/lib/locale.js`
  Locale helpers for formatting and regional behavior.

## Naming guidance

Prefer keys like:

- `common.actions.save`
- `classes.toasts.roomCreatedTitle`
- `landing.footer.notice`
- `studentPortfolio.cards.totalValue.title`

Avoid keys like:

- `text1`
- `messageA`
- `titleLabel2`

## When adding new UI

1. Add the key to `es.js`.
2. Mirror the same key in `en.js`.
3. Consume it from the component with `t(...)`.
4. Use interpolation for names, counts, prices, and dates.
5. If the text is reusable, place it in a stable domain instead of duplicating literals.

## Recommended follow-up

- Finish migrating the remaining hardcoded strings in `ClassesPanel`, `TeacherPortfolio`, and `AccountSettingsSection`.
- Keep new teacher/student modules inside `teacher.*`, `studentPortfolio.*`, or `classes.*` depending on ownership.
- Review future PRs for hardcoded `aria-label`, `title`, `placeholder`, and empty-state copy before merge.

## Hardcode prevention

- Run `npm run i18n:audit` before merging UI changes.
- The audit scans `src/` for obvious hardcoded JSX text and common accessibility attributes like `placeholder`, `title`, `aria-label`, and `alt`.
- It ignores `src/Languages/*` and a few non-UI folders by default.

### Allowed escape hatches

- Add `i18n-audit-ignore-next-line` on the previous line when a literal is intentionally not translatable.
- Add `i18n-audit-ignore-file` only when the whole file should stay outside i18n on purpose.

### What should still stay out of i18n

- Product brand names like `GlobalTradeLab`
- Market symbols such as `BTCUSD`
- Compact market markers like `O`, `H`, `L`, `C`
- Raw URLs, emails, and similar identifiers when they are not user-facing copy
