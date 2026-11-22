# ADR 0063: One hierarchy and one rhythm, set in the tokens

- **Status:** Proposed. The tokens and the shared parts are area 1's, so Richie accepts or declines it in review. The small class changes on the pages of areas 2, 3 and 4 are presentation only and are listed in the pull request for each owner.
- **Date:** 2026-11-22
- **Story:** [#364](https://github.com/xiu2809xiu-rgb/orderpilot/issues/364)

## Context

On 22 Nov Richie asked for a clearer visual hierarchy and more breathing room, without changing any function or logic. A survey of main (f2bf64f3) measured what the pages did:

- The space from the page head to the first content was 16, 24, 40, 48, 64 or 72 px, depending on the page. The head's own bottom margin was an unlayered rule that beat Tailwind's `space-y-*`, and in a flex column it was added on top of the gap. Four copies of that rule existed.
- Card padding was 20 px, which is off the 8 px grid, and six kinds of card wrote their own.
- The gap between stacked blocks was 16, 24, 32, 40 or 48 px.
- A block title (14 / 600) sat 2 px under a card title (16 / 600), the Insights metric titles were 14 / 400, and small print used the body colour although a quieter tier existed.
- The design system said "an 8-pt grid" and "cards 24 px apart", which the pages did not do.

## Decision

1. **Seven levels from the existing scale.** The seven sizes are unchanged. Page title, intro, card title, block title (new `.dx-block-title`, 14 / 600 ink), body, small print (new `.dx-meta`, 12 px in the faint colour) and numbers are told apart by weight, colour and space. The levels table is in [the design system](../design/design-system.md).
2. **Four rhythm tokens, all on the 8 px grid**, declared in `tokens.css`: `--dx-card-pad` 24 px (was 20), `--dx-head-gap` 24 px, `--dx-stack` 32 px and `--dx-grid-gap` 24 px. The head binds to its first content at 24 px, major blocks stand 32 px apart, and cards side by side or in a grid are 24 px apart.
3. **One page stack.** `.dx-page` is a flex column with `gap: var(--dx-stack)`. A page root is `dx-sheet dx-page` (72 rem) or `dx-sheet-wide dx-page` (100 rem, new, for pages of tables) in place of `space-y-*` and `gap-*`. The head's margin has one rule in `surfaces.css`, and the three copies in `page-header.css` and `orders.css` are gone. In a stack the head pulls itself back by the difference between the stack and the head gap.
4. **The faint colour is for cards and panels only.** Measured in `tokens.test.ts`'s helper, `--faint-foreground` on the bare ground is 2.6:1 in light and 3.5:1 in dark, so the date line, the page intro and any hint on the ground stay in the body colour. On `--card`, `--panel-strong`, `--popover` and `--secondary` the existing test already holds it at 4.5:1 or more.
5. **Tables keep their density.** Header 36 px, rows 40 px and `px-3 py-2` cells are pinned by `dense.test.tsx` and are not changed. The air goes around a table: the bar above it is 8 px between controls and 16 px to the table, the card is 24 px padded, and the head is 24 px from the first control. Control heights and 44 px touch targets are unchanged.
6. **Nothing the code does changes.** No logic, props, text, i18n key or route is touched. The class changes on pages of areas 2, 3 and 4 are a root class, a few paddings and a measure of 80 characters on a meta line.

## Consequences

- Pages that were at 32 px between sections keep 32. The order page goes from 16 to 32 between its stacked cards and 24 inside its top row, so fewer of its rows fit in the first screen at 1366 x 768. Pages that had 40 to 72 px from head to content (tracker detail, Insights, the record pages, the order form, Steps and the SPR page) come down to 24.
- 8 px more padding in a card takes 16 px from a table inside it. The end-to-end checks on the audit table and the Orders list measure that.
- A new page starts from `dx-sheet dx-page` and the tokens. A page that writes its own rhythm goes against this record.
- The 4 px step stays inside a line of text or a control (a label over its value, a title over its description). It is not used between blocks.
- Not done here: the dead area right of Home's timeline card (it needs content moved) and the 4-row chrome above a record page (the shell's, not a page's). The Orders stage cell, whose row is 80 px because "Shipped, AWB overdue" wraps to three lines, is a density question and is left as it was.
