# Research

Domain research that makes OrderPilot realistic: document types, fields, numbering and statuses.

| Document                        | What it holds                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Domain notes](domain-notes.md) | What standard Navision keeps and how OrderPilot uses it, and patterns from a small-business inventory system |

## Richie's ERP notes

Richie studied a third-party ERP. His notes on it go in this folder, as Markdown, **in his own words only**.

- **Names, fields and flows only.** The notes say which documents exist, which fields they carry, how they are numbered and which statuses they move through.
- Use proven patterns freely. Sidebars, data tables with filters, KPI tiles, document pages with line items, timelines and role home pages are standard conventions, and nobody owns them. Borrow the best of them from Linear, Stripe, Navision's Role Centers and the inventory system's flows, and aim for the UI bar in prompt 001, section 9.
- Make it ours. Build every screen from our own design system: our tokens and components, Lucide icons, and our own wording for Spectra's users. Don't reproduce another product's icons, images, logos, brand colours or text, and don't make a screen a recognisable clone of another product's.
- No screenshots of any other product in the repository.
- **No screenshots or data.** Never ask for, open, commit or send to an AI service any screenshot or data from that ERP.
- **No product names** beyond what a note needs to make sense, and nothing that would read as an endorsement.
- **One topic per file,** named for the topic, for example `document-numbering.md`. Add each new file to the table above.

Teammates may add research of their own on the same terms: their own words, public sources cited by name, and no client material.

## Spectra's material

Spectra's documents, slides and samples never go into Git, this folder included. What we learn from them is written up in our own words in [the problem statement](../problem-statement.md), [the assumptions](../assumptions.md) and [the data formats](../data-formats.md).
