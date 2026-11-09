# Demo documents

Synthetic demo data. Twelve PDFs of fictional companies, with USD prices and demo bank details that cannot be paid into. Nothing here is a real document, and none comes from a client.

Each file is tied to an order in the synthetic data (`2026-11-02` is the reference date they are made on) and has a JSON file beside it with the ground truth: every field's value, its page and box (fractions of the page, from the top-left corner), and the confidence Mock AI reports. A field is uncertain when its confidence is under the shared threshold of 0.9.

| File | Document | Order | Layout | Uncertain fields | What it is for |
| --- | --- | --- | --- | --- | --- |
| `po-boxed-so-0102.pdf` | Customer PO PO-IN-4807 | SO-0102 | boxed | 2 | A boxed form, two pages, with the payment terms overleaf. Its task says to confirm 2 uncertain fields, the one to try in the sales pilot. (`po-boxed-so-0102.json`) |
| `po-letter-so-0119.pdf` | Customer PO PO-LK-4926 | SO-0119 | letter | 0 | A plain letter. Mock AI has not read it yet, so its task says to check the fields. (`po-letter-so-0119.json`) |
| `po-table-so-0115.pdf` | Customer PO PO-BD-4898 | SO-0115 | table | 3 | A dense table printout. Its task says to confirm 3 uncertain fields. (`po-table-so-0115.json`) |
| `po-branded-so-0101.pdf` | Customer PO PO-PK-4800 | SO-0101 | branded | 4 | The customer's own look. Its task says to confirm 4 uncertain fields. (`po-branded-so-0101.json`) |
| `po-letter-so-0120-scanned.pdf` | Customer PO PO-LK-4933 | SO-0120 | letter (scan) | 21 | A scan: slightly tilted, grey paper, speckled, and an image with no text in it. What Mock AI does with a file it can only see. (`po-letter-so-0120-scanned.json`) |
| `po-table-so-0041.pdf` | Customer PO PO-BD-4380 | SO-0041 | table | 0 | The PO that the packing list pl-so-0041-mismatch is checked against. (`po-table-so-0041.json`) |
| `pl-so-0041-mismatch.pdf` | Packing list PL-0041 | SO-0041 | house | 0 | The mismatch for end-to-end test 1: line 1 packs fewer pieces than the PO orders. (`pl-so-0041-mismatch.json`) |
| `pl-so-0026.pdf` | Packing list PL-0026 | SO-0026 | house | 0 | A packing list that agrees with its order. (`pl-so-0026.json`) |
| `pi-so-0075.pdf` | Proforma invoice PI-20261030-0002 | SO-0075 | house | 0 | A PI for a 30% deposit, with Spectra's demo bank details to pay into. (`pi-so-0075.json`) |
| `pi-so-0051.pdf` | Proforma invoice PI-20261023-0002 | SO-0051 | house | 0 | A PI for a 50% advance on a single line. (`pi-so-0051.json`) |
| `pi-so-0063.pdf` | Proforma invoice PI-20261029-0001 | SO-0063 | house | 0 | A PI for payment in full before shipment. (`pi-so-0063.json`) |
| `invoice-so-0001.pdf` | Commercial invoice SI-100000 | SO-0001 | house | 0 | A commercial invoice on 30-day terms, with its due date. (`invoice-so-0001.json`) |

## Making them again

These files are generated. Do not edit them by hand.

```
pnpm docs:generate
```

The dates on the files, and the number of a proforma invoice (which carries its date), are those of `2026-11-02`. The dates in the app move with today, so after that day the three PIs show another number in the app than the file prints. Every other number agrees on any day.

A test regenerates all twelve and compares them with these byte for byte, so the script and the files cannot drift apart. If a change to the synthetic data or to a layout changes a file, that test fails until the files are regenerated and committed.
