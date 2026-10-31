# ADR 0014: i18n with English first

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-11

## Context

OrderPilot is English first and has no other language in scope. Even so, text scattered through components is hard to review, hard to reword for the client and slow to fix when a label is wrong. And every area adds text, so the way it is stored decides whether the entry bundle grows with each area.

## Decision

1. **react-i18next with one language, `en`.** `supportedLngs` is `["en"]`. No language picker is shown: the settings page says the app is in English.
2. **No hard-coded strings.** Every visible string, `aria-label` and `title` comes from `t()`. A test parses each `.tsx` file (outside the vendored `components/ui`) with the TypeScript compiler and fails on JSX text or a text attribute that is a literal. The test is itself tested against a known bad snippet.
3. **One namespace per feature, loaded on demand.** `src/locales/en/common.json` is bundled into the entry (the shell, the sign-in, errors, roles, settings). Every other file in `src/locales/en/` is a namespace, found with `import.meta.glob` and loaded by a small backend plugin when a component asks for it, so each is its own chunk. A feature's namespace has the same name as the feature (`orders.json`) and holds its `title`, `description`, the `arrives` list for its planned page, and `cues.<id>` for its home page tiles. The area owns its file.
4. **The shell loads every namespace once,** after sign-in, because the menu, the command palette and the home tiles name every area. They are small and sit outside the entry bundle.
5. **Text for server errors comes from the code, not the message.** `errors.codes.<ERROR_CODE>` maps each code in `@orderpilot/shared` to words for a person, and the trace id is shown beside it. The server's own `message` is never displayed.
6. **Validation messages are built per language.** Form schemas are made inside the component with `t()` messages, so the error text on a field is translated too.
7. **Roles and permissions** are shown with `roles.<ROLE>` keys. The English labels in `@orderpilot/shared` are not used by the web app.
8. **Dates, numbers and money** are not formatted yet: no screen shows any. When one does, it uses `Intl` with the locale, and money from `@orderpilot/shared` stays a decimal string until the last moment.

## Consequences

- A reviewer can read a whole area's wording in one JSON file.
- The entry bundle holds only `common`. The budget test would catch a namespace slipping in.
- A second language would need a folder of files, `supportedLngs` and a picker. It is not planned, so none of that exists.
- The "no literal text" test finds literals in JSX only. Text built in plain TypeScript (a thrown error message, say) is not covered, and is never shown to a person.
