# ADR 0061: A section list with one section at a time, and one shortcut registry

- **Status:** Proposed by Richie's agent. Richie accepts or declines it in review. It is area 1's, because the shell and the settings page are.
- **Date:** 2026-11-22
- **Story:** [#349](https://github.com/xiu2809xiu-rgb/orderpilot/issues/349)

## Context

Richie found the settings page unpleasant in its layout, its look and its content. It was one narrow stack of cards that mixed jobs. It told a user things they never need (a wall of permission codes, raw service names, a long paragraph about analytics, today's date under the title) and left out things people do need: signing out, the shortcut list, whether the AI is real, a way to reset a messy table layout, and what their role is for and who changes it.

The page also held two small copies of work the shell does: the sign-out flow lived only in the account menu, and the side panel's choice lived inside one hook, so Settings could not change it. The keys the app answers to were written five times (the handlers, the Help panel's text, the palette's footer and the strings), so the lists could say something the keys did not do.

## Decision

1. **A section list on the left and one section at a time on the right**, each section a few cards of divided rows (label, one plain line, control). The section is in the address (`/settings?section=appearance`), so Back works and a section can be linked. Each section fits one screen, so there is no scroll-spy. Below 768 px the list is one scrolling row of 44 px pills. This is the shape of GitHub's and Vercel's settings (a list of sections), Linear's (one section shown) and Stripe's (cards of rows).
2. **Seven sections in two groups.** You: Account, Appearance, Keyboard shortcuts, Privacy. OrderPilot: AI assistant, Controls, System health. A section the role may not open is not listed. Controls is listed only if the role may open at least one of its pages (People needs `users.read` and `roles.read`, because the People tab lives on the governance page). System health needs `settings.manage`. A stale link to a section the role may not see shows the permission-denied state and keeps the list.
3. **Only what a person needs.** Permissions are told as a line for each kind of work, built from the session's permissions with their wording in the locale file, and the codes are never shown. The matrix is never copied. Services are told as "Everything is working" with the list behind Show details, and what a failure affects is said in words. Reduced motion, text size, density, notifications, passwords and sessions are not on the page, because the app has no store or route behind them. The Business rules row is not on the page either: the rules have no page of their own and Home does not scroll to a block, so a row would lead nowhere.
4. **Every choice applies at once and is kept on this device.** There is no Save or Cancel. A footnote says "Saved on this device." The side menu can go back to Automatic, which removes its key, so the side panel's choice becomes a small shared store (`panelCollapsedStore`) that the bar and Settings read. Reset of the saved table layouts clears only the signed-in person's keys and offers Undo.
5. **One registry of shortcuts** (`app/shell/shortcutRegistry.ts`). Each entry has its key, whether it takes Ctrl or Command, its group, and whether it needs Spark. The handlers read their key from it, and the Help panel and Settings draw their lists from it. A test presses each registry key and checks that the real handler answers, and that a new entry cannot be added without such a check. Key caps (Ctrl, Cmd, Esc) come from the platform through the shortcut registry, not from the locale files, because they are labels of the keyboard, not prose.
6. **One sign-out hook** (`useSignOut`) for the account menu and Settings, with the same question when a form has unsaved changes. It goes to the sign-in page whether or not the server call succeeds, because `logout()` has already ended the session here.
7. **The theme is three tiles that draw each theme with its own colours** (`--pv-*` tokens), so the Light tile stays light on a dark page. The theme group keeps its hand-written arrow-key handling, not the Radix radio group: Radix chooses on an arrow only when the key is still down as the focus lands, which a real keyboard does and a synthetic `{ArrowRight}` in the test of the theme group does not, and that test is the behaviour we promise. The Side menu choice uses the Radix radio group (`components/ui/radio-group.tsx`).
8. **Area 4's analytics card changes in presentation only**: one switch under Privacy in place of Allow and Do not allow. Its hooks, the tracker calls and the consent rules are unchanged, and the new strings need Angelyn's OK before merge.

## Consequences

- The page can grow by adding a section, not by lengthening a stack.
- The shell and Settings cannot disagree about the side panel, sign-out or the keys.
- The old `ServiceChecksCard` is gone. Its role as the worked example of a generated hook (ADR 0019) moves to `useServiceHealth`, and the three documents that named it are updated.
- A new permission shows under "Other" with its governance label until someone gives it wording.
- The order lines table has keys of its own (Enter, Esc, Delete, Alt with the arrows). They are not in the registry yet. Adding an "In order lines" group, shown to roles that edit orders, is a follow-up.

Amended by ADR 0070: availability is a Settings choice kept on the server, with two-step (ADR 0068), because colleagues read it.
