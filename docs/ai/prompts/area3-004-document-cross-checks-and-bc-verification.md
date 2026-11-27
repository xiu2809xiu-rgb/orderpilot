# Prompt area3-004: document cross-checks and Business Central verification

Iok Teck's prompts for the Checks tab, on branch `feat/area3-order-tabs-ux`,
as written, in the order sent across the session.

## 1. Restyling the Checks tab as cross-check cards

The ask was to restyle the Checks tab on the real order page
(`apps/web/src/features/directions/screens/order`) into cards for four
document cross-checks: PO against PI, PO against PL, PI against SI, and PL
against the AWB/BL, each with a line table. Built `PairTitle`, `LineRow`,
`LineTable` and `Result` in `ChecksTab.tsx`, and the comparison logic in
`apps/api/src/modules/checks/domain/mock-samples.ts`.

## 2. Highlighting, walked back twice

```text
For items/things that are mismatched, should highlight them out like in
the attached screenshot
```

Added a highlighted background to the whole mismatched card.

```text
No need highlight entire box
```

Removed the card-level highlight, kept a highlighted table row instead.

```text
Table dont need highlight also
```

Removed the row highlight too, leaving only bold, amber text on a
mismatched value, no background colour at either level.

```text
If there are a lot more mismatches? How would they be displayed?
```

Capped the mismatch notes at three lines with an "and N more" line
rather than letting the card grow without limit.

## 3. Gating the upload button by permission

```text
Can u make an upload button under those that have missing files
```

Added it, then:

```text
I think for those roles who cannot upload files no need put the upload
button
```

Gated the button on the same permission the rest of the page already
checks, rather than showing it and disabling it.

## 4. The Business Central Verification group

```text
Now for business central verification can u make it something like
this layout, 3 checks. Customer record, item catalog & unit pricing,
Live inventory availability
```

Two screenshots, a pass state and a fail state, set the layout. Built
`customerRecordCheck`, `itemCatalogCheck` and `liveInventoryCheck` in
`mock-samples.ts`, each read from the order's own real customer, item and
inventory fields (credit limit and balance, agreed price against the
item's unit price, inventory against the ordered quantity), with nothing
invented. Asked first whether to fabricate a failing scenario:

```text
Ok maybe for now just do it on exisiting data first
```

So the fail state stayed on real data only, for a check with no field to
fail it against yet (for example PI against SI amounts, with no such
mismatch in the sample set).

Running the tests after this round turned up that deleting the Checks
tab's old matches table had removed i18n keys a separate, still-registered
page used:

```text
Unable to find element... matched on Business Central numbers
```

`features/order-tracker/MasterMatches.tsx`, reached at
`/order-tracker/:orderNo`, still read `detail.matches.*`. Flagged the two
pages before touching anything further.

```text
Order-tracker isnt used anymore
```

Restored the keys regardless, since the fix costs nothing either way, and
went on.

```text
Business central verification should be below documents check btw.
Also no need for the Matched to Business Central table already as the
verifications are to replace that. Also for Item Catalog & Unit Pricing
Business Central verification, the prices dont actually match but it
says it matches. For Live Inventory Availability Business Central, if
on hand in BC more than ordered, result should say covered instead of
match.
```

Moved the new group below the document cross-checks, deleted the old
"Matched to Business Central" table and its component, prop and locale
keys, switched the item-catalog price check from a 15 percent tolerance
to an exact match (the tolerance had been hiding a real mismatch), and
added a `resultLabel` field so Live Inventory can say "Covered" instead
of "Match" once Business Central holds more stock than the order needs.

## 5. Auto-expand, wording and animation

```text
Could u continue. also the details should only be auto expanded when
there is a problem. If everything matches should not expand.
```

Changed a check's details to open by default only when
`outcome !== "pass"`.

```text
Can replace SKU/SKUs with Item/Items instead? Also for mismatch instead
of saying item mismatch example, just say number of mismatches like
'2 mismatches' etc. For Live Inventory Availability Business Central,
the I-xxxx Item name thing should follow styling of the top like in
Item Catalog & Unit Pricing Business Central etc.
```

Renamed SKU to Item throughout, added a `mismatchCountLabel()` helper so
a mismatch chip reads "{count} mismatch(es)" instead of a fixed phrase,
and matched Live Inventory's stacked item-number-and-name cell to Item
Catalog's own styling.

```text
Could u make a subtle animation when u press the details button.
```

Switched the details panel from `hidden` to `inert` so it keeps a real
height to animate, collapsed it with a CSS grid-row transition
(`1fr` to `0fr`) rather than a fixed max-height, and rotated the chevron
by a `data-open` attribute instead of swapping icons. Both already run
through the app's existing `prefers-reduced-motion` rule.

## 6. The Exceptions page's link

```text
Just a short one, for exceptions page, can u not link it to the old
order tracker but to the new orders instead.
```

Replaced the three `/order-tracker` links in `ExceptionsPage.tsx` with
`/orders`, and reworded the empty-state action text to match.

## Review

Iok Teck supplied every screenshot and read each result in plain language
before the next round, walked back both highlight styles once they were
visible, caught the two points where the Business Central checks reported
the wrong thing against the real data, and confirmed the order tracker
page is no longer used once a regression on it was found, so it was fixed
anyway but not treated as a blocker. The real tests were run after every
round, and only one pre-existing, unrelated failure was ever reported
left standing.
