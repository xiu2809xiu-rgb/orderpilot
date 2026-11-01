# Demo documents

Synthetic demo data. Twelve PDFs of fictional companies, with USD prices and demo bank details that cannot be paid into. Nothing here is a real document, and none comes from a client.

Each file is tied to an order in the synthetic data (`2026-11-02` is the reference date they are made on) and has a JSON file beside it with the ground truth: every field's value, its page and box (fractions of the page, from the top-left corner), and the confidence Mock AI reports. A field is uncertain when its confidence is under the shared threshold of 0.9.

| File | Document | Order | Layout | Uncertain fields | What it is for |
| --- | --- | --- | --- | --- | --- |
| `po-boxed-so-0115.pdf` | Customer PO PO-IN-4898 | SO-0115 | boxed | 3 | A boxed form, two pages, with the payment terms overleaf. Its task says to confirm 3 uncertain fields. (`po-boxed-so-0115.json`) |
| `po-letter-so-0101.pdf` | Customer PO PO-LK-4800 | SO-0101 | letter | 4 | A plain letter. Its task says to confirm 4 uncertain fields, one of them the price on line 1. (`po-letter-so-0101.json`) |
| `po-table-so-0114.pdf` | Customer PO PO-BD-4891 | SO-0114 | table | 2 | A dense table printout. Its task says to confirm 2 uncertain fields, the one to try in the sales pilot. (`po-table-so-0114.json`) |
| `po-branded-so-0112.pdf` | Customer PO PO-PK-4877 | SO-0112 | branded | 1 | The customer's own look. Line 1 is printed 1.50 under the price list, and that price is the one uncertain field. (`po-branded-so-0112.json`) |
| `po-table-so-0120-scanned.pdf` | Customer PO PO-BD-4933 | SO-0120 | table (scan) | 26 | A scan: slightly tilted, grey paper, speckled, and an image with no text in it. What Mock AI does with a file it can only see. (`po-table-so-0120-scanned.json`) |
| `po-letter-so-0041.pdf` | Customer PO PO-LK-4380 | SO-0041 | letter | 0 | The PO that the packing list pl-so-0041-mismatch is checked against. (`po-letter-so-0041.json`) |
| `pl-so-0041-mismatch.pdf` | Packing list PL-0041 | SO-0041 | house | 0 | The mismatch for end-to-end test 1: line 1 packs fewer pieces than the PO orders. (`pl-so-0041-mismatch.json`) |
| `pl-so-0026.pdf` | Packing list PL-0026 | SO-0026 | house | 0 | A packing list that agrees with its order. (`pl-so-0026.json`) |
| `pi-so-0097.pdf` | Proforma invoice PI-20261102-0002 | SO-0097 | house | 0 | A PI for a 30% deposit, with Spectra's demo bank details to pay into. (`pi-so-0097.json`) |
| `pi-so-0079.pdf` | Proforma invoice PI-20261029-0004 | SO-0079 | house | 0 | A PI for a 50% advance on a single line. (`pi-so-0079.json`) |
| `pi-so-0063.pdf` | Proforma invoice PI-20261029-0001 | SO-0063 | house | 0 | A PI for payment in full before shipment. (`pi-so-0063.json`) |
| `invoice-so-0005.pdf` | Commercial invoice SI-100004 | SO-0005 | house | 0 | A commercial invoice on 30-day terms, with its due date. (`invoice-so-0005.json`) |

## Making them again

These files are generated. Do not edit them by hand.

```
pnpm docs:generate
```

The dates on the files, and the number of a proforma invoice (which carries its date), are those of `2026-11-02`. The dates in the app move with today, so after that day the three PIs show another number in the app than the file prints. Every other number agrees on any day.

A test regenerates all twelve and compares them with these byte for byte, so the script and the files cannot drift apart. If a change to the synthetic data or to a layout changes a file, that test fails until the files are regenerated and committed.
