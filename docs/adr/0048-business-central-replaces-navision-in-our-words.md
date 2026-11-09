# ADR 0048: Business Central replaces Navision in our words

- **Status:** Accepted
- **Date:** 2026-11-09
- **Story:** P-83

## Context

The first brief named Microsoft Dynamics Navision as Spectra's ERP. Spectra now runs Microsoft Dynamics 365 Business Central, the product that Navision grew into. Every page, document and name in the repository said Navision, so a person reading OrderPilot saw the wrong product, and a new teammate searching for the ERP's name found the old one.

The old word is also in places that a program reads. A column, a JSON property, a stored value, a translation key or an exported type is part of a contract, and renaming one is a different kind of change from rewording a sentence: it needs a migration, a version of the API or a change in another owner's code.

## Decision

1. **The rule.** Change what a person reads. Keep what a program stores or another area compiles against.
2. **What changes.**
   - Every page's text, with the translation values changed and their keys kept.
   - The documents under `docs/`, `CLAUDE.md`, `README.md` and `CONTRIBUTING.md`. Each page names Microsoft Dynamics 365 Business Central once and then says Business Central.
   - Area 1's own code names where the rename stays inside area 1: the mock master data class and its file, the `mockNavision` badge kind and the Swagger summaries.
   - Comments, test titles and request files that only describe the mock.
   - The planned mock service is `services/mock-business-central`.
3. **What stays, and why.**
   - **Database columns.** `SalesOrder.navisionNo` and `WorkflowRecord.navisionNo` keep their names. There is no migration and no `@map`, because a rename would lock a table and add a step to every deploy for a word nobody reads. A comment on `SalesOrder.navisionNo` says it holds the Business Central number, and the migration text stays as it was applied.
   - **Wire properties.** `navisionNo` and `navisionStatus` keep their names, because areas 2 to 4 read them. A rename would break their code in the middle of their sprint.
   - **The stored value `"navision"`.** It names a source in rows that already exist.
   - **Translation keys.** A key is an identifier, and no one sees it.
   - **Shared exports.** `navisionNoSchema`, `NavisionStatus`, `NAVISION_STATUSES` and `navisionStatusSchema` keep their names, because area 2 imports `NavisionStatus`. An alias such as `erpNoSchema` is not added: it would give one thing two names while the wire keeps the old one.
   - **Other areas' words.** Their guides, identifiers and comments are listed in each owner's issue, and the owners change them.
   - **History.** Prompts 001 to 006, the AI usage log and the merged ADRs are records of what was said then, and stay as they were written. The `RENAMED` map in the backlog script and its test quote prompt 001, so they keep the old word too.
4. **API v2.0.** Business Central's API v2.0 names many fields differently from the names we assumed. The data formats and the domain notes say so, and the connector (planned: P-20) maps the API's names to ours.

## Consequences

- A search for the old word still finds the kept names. This ADR is the list of why, and each owner's issue is the list of what is theirs.
- A reader meets Business Central everywhere a screen or a page speaks, and a column named `navisionNo` is explained by one comment instead of a migration.
- If the wire is ever versioned, the properties can be renamed then, with the owners, and this ADR is superseded by that decision.
