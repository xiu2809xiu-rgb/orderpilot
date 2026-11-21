# Prompt area3-003: the order page's status, facts and journey cards

Iok Teck's prompts for the order detail page, on branch
`feat/area3-order-details-ux`, as written, in the order sent across the
session.

## 1. Finding the real page

The first ask, with a mockup image, was to redesign "the order details page"
in `apps/web/src/features/orders`. That folder turned out to hold the order
entry form, not a detail view. Asked what was meant, and traced the actual
page: `/order-tracker/:orderNo` in `features/order-tracker`, Area 3's own
page, built the cards there on that basis first.

```text
Order tracker is deprecated and not in use already.
```

The real page is `/orders/:orderNo`, `OrderPage.tsx` under
`features/directions/screens/order`, Area 1 (Richie's). Reverted every
order-tracker change with `git checkout` and `del` rather than leaving dead
work sitting in the wrong area.

```text
I have gotten permission that I can edit the orderpage
```

With that sign-off, rebuilt the same redesign on the real page, reusing its
already-wired data (value, PO, dates, prepayment, lateness, the latest
act) instead of the tracker's mock fields.

## 2. The status and facts cards

```text
Can the top one say Current Stage and font style must be same as the
word "Journey". Also on a bigger screen, can u make it so the current
stage rectangle thing is on the left, and the value rectangle thing on
the right. The "All steps" and "View exception" button should be actual
buttons.
```

Moved "Stage" and "Held at" out of the six-up facts bar into a new
`OrderStatus` card of their own, gave "Current Stage" the same
`dx-section-title` style as the journey card's own heading, put the stage
card and the facts bar side by side above 64rem with `.od-top-row`, and
turned "All steps" (`LatestAct.tsx`) and "View exception" into real
`Button` components instead of plain links.

Follow-up rounds, each applied and checked before the next: a rule between
the latest act and the exception line, the "All steps" and "View
exception" buttons right-aligned, the "Value" label styled like "Current
Stage", the PO/order date/ship date facts centred under it, removing the
"Next: ..." clause and then the whole "With team" prefix from the one
sentence under the title, the customer name inline with "Sample" with no
comma and its number styled as the Orders table styles it, and the
customer name itself in full-contrast white.

```text
U can remove the "Next" Line
```

```text
U dont need to put the "With ..." linr
```

```text
There is no need for the line between the current stage and the latest
Eg. the "80 short on..."
```

Each request cut the sentence further: first dropping the named next step,
then the "With {team}" lead-in, then the sentence itself, since "Current
Stage" and "Held at" already say what it would repeat. `statusSentence.ts`
and its test were deleted once nothing called them.

## 3. The merge, and keeping both sides' work

```text
Can u fix the merge conflicts for me please on the 7 files?
```

`main` had moved on the same files while this branch worked: it kept
`statusSentence.ts` and extended it with a reason for a failed check (not
only a shortage), kept "Stage" and "Held at" inside the facts bar wrapped
in the new glossary `Term` component, and touched `order.css` next to this
branch's own new rules. Read every conflict side by side rather than
picking one, and reported the real disagreement instead of resolving it
alone, since AGENTS.md rule 1 asks that a conflict is shown, not thrown
away.

```text
Maybe keep our redesign, but reapply the check-reason work on top of it.
```

Kept this branch's card split and the removed sentence's shape, but
restored `statusSentence.ts` in a form that matches it: no team, no next
step, just the one reason (a shortage, or else the first failed check) as
a plain "{{why}}." line, re-adding the matching locale keys and tests.
`OrderFacts.tsx` kept this branch's four facts, without the incoming
glossary wrapping, which had been on "Stage" and "Held at", both now gone
from that file.

Running the real tests after the merge found two regressions the resolve
itself had not caught:

```text
There is no output for OrderPage.status.test.tsx > the status card >
shows a finished order's own stage, with nothing more said about it
AssertionError: expected <p ...>A check did not pass: Rule quantity.</p>
to be null
```

A finished order's stale failed check was still read as a reason to show
the sentence. Fixed by forcing the sentence to nothing once the journey's
current step is `ALL_DONE`. The second regression, `OrderPage.test.tsx`'s
"explains Held at where it is a heading of the facts", had lost its
`<Term word="heldAt">` wrapping when "Held at" moved into `OrderStatus.tsx`
during the earlier redesign; re-added it there, and fixed the test's
anchor text from "Stage" to "Current Stage" to match the renamed heading.

## 4. The journey card

A detailed, numbered spec for the journey card's header, step contrast and
rail colour, given in full:

```text
Update ONLY the Journey card component on the Order Detail page (keep
all other sections untouched):
1. Header & Expected Ship Line: ... Journey title with a muted subtitle
   ... Est. ship Thu, 3 Dec ... a compact status pill (On track in
   emerald, At risk in amber, or Delayed in red)
2. Step Label Contrast & 1-Line Subtitles: ... Completed steps ... bold
   white ... Active step ... bold white with state-coloured subtitle ...
   Upcoming ... muted grey ...
3. State-Aware Track & Node Gradients: ... teal-to-emerald / amber / red
   gradient line + glowing circle, by order health
```

Built `orderTone.ts` (critical when overdue, warning when something
holds the order, normal otherwise) and threaded it through
`OrderJourneySection` → `OrderJourney` → `JourneyRail` as an optional
`tone` prop, scoped in CSS to `[data-size="full"]` only, since
`JourneyRail` is shared with the Orders list row and the side peek's
vertical rail, neither of which this ask touched. Rewrote `ExpectedShip`
into a compact date and a `StatusChip` pill instead of its old long
sentence, and moved the forecast's basis into the new subtitle. Updated
the two tests that had checked the old sentence's exact wording.

```text
Can the "Value" word be same styling as the "Current Stage". The PO
number etc can they be in the middle vertically
```

```text
Can the all steps and View exception button be right align
```

Both applied the same way: a scoped CSS change, then the real tests run
again before moving on.

## 5. Two follow-up fixes, by eye

```text
In ONLY the Journey component (do not edit other sections), fix the
truncated subtitle (`Waiting 5 days,...`):
1. Remove truncate / whitespace-nowrap ... use whitespace-normal
   leading-tight
2. Shorten the waiting subtitle format to `Waiting 5d · ~1d avg`
3. Remove the small redundant inline icons (✓, ⊙, ○) ... Testing i will
   do manually
```

Switched `.jr-detail` from a single-line ellipsis back to wrapping,
shortened `journeyText.ts`'s compact wait wording to `Waiting {{count}}d
· ~{{usual}} avg`, and hid the step icon only when `size === "full"`, so
the Orders list row and the side peek kept theirs. Iok Teck tested this
round by hand rather than asking for another test run.

```text
Could u make it so the second line for the journey thing is aligned
with the "PO received" eg. text.
```

The second line's left padding had been sized for an icon beside the
title; with the icon gone on the full rail, zeroed that padding so the
two lines sit flush, scoped to `[data-size="full"]` only.

## Review

Iok Teck set the scope on every round (which file, which component, "do
not edit other sections"), decided the design call at the merge conflict
rather than letting either side win by default, chose when a test run was
needed and when eyes alone would do, and ran or commissioned the real
commands throughout: a skipped or still-running check was reported as
such, never as passed.
