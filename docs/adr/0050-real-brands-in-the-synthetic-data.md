# ADR 0050: Real brands in the synthetic data

- **Status:** Accepted. Richie reads the brand list once for real part numbers.
- **Date:** 2026-11-10
- **Story:** P-86

## Context

The synthetic set so far used fictional brands, five countries and a price group on every customer. At the briefing of 5 Nov 2026 Spectra told us how its business looks, and prompt 005 (section 10) turned that into a brief for the data: real brand names, the six categories of its portfolio, customers in eleven countries, 24 months of history with seasonality, lead times, and a few planted cases. Richie decided on 9 Nov that the real names Spectra carries may appear in the demo data.

The 120 live orders are pinned by many tests, screens and demo documents, so the new data has to sit beside them. It could not leave them untouched, because the customers grew from 40 to 64 and the catalogue changed (see the paragraph after the decision). [ADR 0047](0047-draft-orders-and-the-duplicate-rule.md) item 10 and the briefing also settled that the PO's price is the agreed price, and that we build no price tables.

## Decision

1. **22 real brands.** Dell, HP, Lenovo, Acer, Asus, Samsung, Intel, Seagate, Toshiba, Kioxia, Lexar, Verbatim, TeamGroup, Cooler Master, Hikvision, TP-Link, Cudy, Aruba, HPE, Supermicro, Vertiv and Honeywell. They are the names prompt 005 lists. Each is owned by one product manager, in one table.
2. **Made-up part numbers.** Each brand gets a part-number style that looks like its own, with an invented body that carries the letters `ZZ` and the item index. No real SKU is intended. A collision with a real one cannot be ruled out offline, and the `ZZ` block makes it unlikely.
3. **No logos and no claim of partnership.** Brand names appear as plain text, under the existing "Synthetic demo data" label. Nothing says that a brand endorses OrderPilot or supplied the data.
4. **Six categories:** components, peripherals, PCs, enterprise, security and networking. They replace the five of the first set. A brand has a primary category, and its items may sit in two.
5. **Eleven countries:** the United Arab Emirates, Pakistan, Sri Lanka, Maldives, India, Nepal, Bangladesh, Vietnam, Singapore, Indonesia and Malaysia. Customers get a real city, an invented street and a postal code in the country's shape. Tax registration numbers are obviously fake: a per-country length, the letters `ZZ`, a run of zeros, and each one unique.
6. **No price tables.** Business Central's Unit Price stays a master field on the item: it is context and never an order price. A customer's last agreed price for an item is derived on demand from a pure function of the seed, the customer and the item, so it is sparse (a pair never bought has none) and needs no table. The customer's price group is dropped, because a group is a price table in disguise.
7. **History lives beside the live set.** 24 whole months of sales lines and vendor receipts, with seasonality, are computed lazily and kept apart. They are never part of the dataset's orders, never a table and never read by a list route. Later stories (the forecast, stock cover) read them through helper functions.
8. **Run rate, cover and lead times** are dataset facts on the item and the vendor. The API exposes them when P-61 needs them.
9. **The people are data only.** Two more management approvers, Marcus Teo and Farah Ismail, and the SPR coordinator, Michelle Lau, who is a Support user, exist in the team list. They are not seeded as login accounts by this story, and the role picker is unchanged. Michelle never owns or is assigned an order.
10. **The planted cases** are built into the records: one order short of stock, one PI whose unit price differs from its PO on a single line, one AWB draft with the wrong consignee, look-alike customer names with their own tax IDs, and one respelled name. The old "price list" mismatch goes, because the PO sets the price.

Pinned, and kept by `stable-live.test.ts`: every live order's number, state, age, and SPR and PI numbers, and the first 40 customers. Changed once: for most orders the customer, the owner and the document list, plus the payment count and the KPI rows. New customers, history and planted values draw from keyed child streams or pure hashes, and never from the main stream. History buyers and live lines are independent: most live lines have no history for their customer and item. The live orders' older dates fall in the last month or two of the history (September and October 2026 for a reference date in November), and that overlap is deliberate. Area 2 (Azri), area 3 (Iok Teck) and area 4 (Angelyn) are asked to review any of their tests that pin a customer, an owner, a payment count or a KPI value.

## Alternatives considered

- **Invented brands.** Rejected: Richie decided on 9 Nov that real names add realism for the audience, and the briefing named them.
- **Renaming the existing 40 customers into 64.** Rejected: it would move every order. We keep C-0001 to C-0040 and add 24.
- **Customer price groups or a price list.** Rejected: the briefing says prices are agreed one by one, and we build no price tables.
- **Building the history eagerly.** Rejected: it would make every seed and every dataset build slower, for data most screens never read.
- **A separate stream per build stage.** Rejected: it would re-roll all 120 orders for no gain.

## Consequences

- History prices rise from month to month, as the client said (question 5 and assumption A-21), so earlier rows are cheaper than later ones and a pair's last row stays at its agreed price. A history line has no cost, so an old price under today's floor is not a loss.
- The invented customer and vendor names were not checked against real business registers, and which vendor supplies which brand is invented. Neither is a claim about a real company.
- The seed stays far under its 30 second budget. Measured on one machine, three runs each, the seed alone (`node dist/database/seed/seed.js` on a fresh database) has a median of 2.85 s, against 2.42 s before, about 18% slower. The full `pnpm db:seed` includes the compile step, and its two single runs (37 s before, 25.6 s after) say nothing about the data.
- Real SKU collisions cannot be ruled out offline. Richie reads the list once.
- The customers on each live order, their lines, totals, the KPI values and the numbers of the exceptions change once. The demo PDFs are regenerated once and a test then keeps their choice loud.
- Old development databases keep stale rows. A review stack starts from a fresh database.
- Area 3's sample of a price mismatch changes to the PI and PO case. Area 3 is asked to review that one file.
- Review at `v0.2-technical-review`.
