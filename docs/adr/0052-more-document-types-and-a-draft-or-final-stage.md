# ADR 0052: More document types and a draft or final stage

- **Status:** Accepted. Areas 2, 3 and 4 are asked to review.
- **Date:** 2026-11-12
- **Story:** P-21, part 1

## Context

`DOCUMENT_TYPES` in `packages/shared/src/order.ts` had ten values. The backlog for P-21 (`docs/agile/backlog.md`, criterion 6 of issue #36) names more kinds of document than that: a vendor's invoice, a delivery order, the SPR form that people print and upload, and a credit note. It also showed that an AWB and a bill of lading arrive twice, first as a draft from the forwarder and then as the final. A draft with the wrong consignee is one of the planted cases in the synthetic data (ADR 0051), and a check has to tell a draft from a final.

P-21 will draw these documents as real PDFs. Its first part is this contract change, so that the renderer and the data are built on a list that is already agreed and reviewed. The contract is read by areas 2, 3 and 4.

## Decision

1. **Four new types.** `VENDOR_INVOICE`, `DELIVERY_ORDER`, `SPR_FORM` and `CREDIT_NOTE` join `DOCUMENT_TYPES`, each beside its neighbours. `OTHER` stays last.
2. **The stage is a marker, not more types.** `DOCUMENT_STAGES` is `draft` and `final`, in lower case like `ORDER_CAPTURE_STATES`. `documentRefSchema` gains an optional `stage`.
3. **Only an AWB and a bill of lading are staged.** `STAGED_DOCUMENT_TYPES` lists them, and `isStagedDocumentType` answers for a type. A stage on any other type is refused by the schema, with the issue on the path `["stage"]`.
4. **No stage stays valid for every type.** It means not known, or not applicable. Nothing is required to carry one.
5. **`SPR_FORM` is the form as a document.** It is a PDF someone uploads or prints. The request record's own settings stay the `SPR` entry of `CONFIGURABLE_DOCUMENT_TYPES`, and a comment in `document-config.ts` says so. The new types get no default settings yet.
6. **A document's type says what it is, not who issued it.** A vendor's packing list stays `PACKING_LIST`, and a customer's proof of payment stays `PAYMENT_ADVICE`.

## Alternatives considered

- **Extra type values such as `AWB_DRAFT` and `BILL_OF_LADING_FINAL`.** Rejected: every rule and every list that means "an AWB" would have to name both values, and a draft that becomes final would change its type instead of a flag.
- **A required stage.** Rejected: most documents have none, and an old record or an email attachment may not say. A required field would invent a value.
- **Reusing `SPR` for the form.** Rejected: `SPR` in the configuration list is the request record's settings, and the form as a file is a different thing with different fields.
- **A type per issuer, such as `VENDOR_PACKING_LIST`.** Rejected: who issued a document is already on its source and its party number, and a type for each issuer would double the list.

## Consequences

- Nothing in the synthetic data or in any rule uses the new values until part 2 of P-21 renders them. The stage is not added to the data in this part.
- No migration is needed: `DocumentTypeConfig.documentType` is text, and no other table holds the list.
- The generated API client changes in two enums that mirror the list and in two mock builders.
- `CONFIGURABLE_DOCUMENT_TYPES` widens with the list, so a settings row for a new type would now be accepted when read. No such row exists, because the seed writes only `DEFAULT_DOCUMENT_CONFIG`, and the settings screen shows a type only once a row is seeded for it. No story has done that yet.
- `documentRefSchema` now holds a refinement, so `.pick()`, `.omit()` and `.partial()` throw at runtime on it. Use `.extend()`, which keeps the rule, or parse a plain base object and refine the result.
- Areas 2, 3 and 4 are asked to review: area 2 for the settings list and the new `SPR_FORM` beside `SPR`; area 3 for check rules that name a document type (`appliesTo`, `trigger`) and may now read a stage; area 4 for any policy or masking rule that lists document types.
- Review at `v0.2-technical-review`.
