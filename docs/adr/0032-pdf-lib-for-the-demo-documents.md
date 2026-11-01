# ADR 0032: pdf-lib for the demo documents, and how a file stays true

- **Status:** Accepted
- **Date:** 2026-11-02
- **Story:** P-52, demo documents (issue 147)

## Context

The review screen (P-53) and the preview (P-54) need real PDFs to read, and a ground truth that says where every field sits on the page. The positions must be exact, because P-54 draws a highlight over them. The same documents also have to be the same bytes every time, so that a committed file and the script that makes it can be compared.

Three needs shape the choice of PDF library:

- the code places each piece of text itself, so its box is known and not guessed by a layout engine;
- it is pure JavaScript, because a native build script needs a reviewed `allowBuilds` entry and breaks on some machines;
- it can embed a font from a file, so a render never depends on what is installed.

## Decision

**`pdf-lib` 1.17.1 with `@pdf-lib/fontkit` 1.1.1**, pinned exactly in `packages/synthetic-documents`. Both are MIT licensed, pure JavaScript and have no install script. Both versions are years old, so `minimumReleaseAge` is met, and `pnpm install` passes the `trustPolicy` check.

Alternatives considered:

| Option             | Why not                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pdfkit`           | Also places text itself and would have worked. `pdf-lib` was tried first and its output was fixed by a metadata call and a font name. |
| `pdfmake`          | A layout engine: it decides where text goes, so the exact box of a field would have to be recovered afterwards.                       |
| A headless browser | The positions of text cannot be read back exactly, and it is a native download. It is also the heaviest thing a test could start.     |
| `jsPDF`            | Written for the browser first, and it brought nothing `pdf-lib` lacked.                                                               |

`pdf-lib`'s last release, 1.17.1, is from 2021. It is used here only to write files, never to read one from outside, so its age is not a risk to the product. If it is ever dropped, the display list below is the part to keep: only `pdf.ts` and `scan.ts` touch the library.

## How the files stay true

- **One drawing, two writers.** A layout draws into a `Canvas`, a list of text, rule and box operations in points from the top-left corner. A writer turns the list into a text PDF (`pdf.ts`) or a scan (`scan.ts`). The box of every field comes from the same measurement that placed its text, using the glyph advances and outlines of the embedded font, so the two cannot disagree.
- **Same inputs, same bytes.** There is no clock and no random seed. The metadata dates are fixed, the fonts have fixed names (`pdf-lib` would add a random suffix), and the paper grain of the scan is a hash of the pixel position. The sine and cosine of the scan's tilt are written out as numbers, so no maths library can move a pixel. Object streams are off, so a PDF is readable by any tool.
- **Dates and numbers are pinned.** Dates in the synthetic set move with today, and a committed file cannot. A document takes its lines, prices, customer and terms from the set it is given, which may be built for any reference date and gives the same result, and its dates and its own number from the set on its fixed reference date (`AS_OF`, 2 Nov 2026). A test builds the set for three other days and compares every file.
- **A scan is an image.** There is no image library in the repository, so `raster.ts` fills glyph outlines and rules with exact horizontal coverage, and `paper.ts` adds the grey paper, uneven light, grain, a copier streak and dust. The result is one greyscale image in a PDF with no text in it. It runs at 100 dots an inch, which keeps the file near 500 KB.
- **A PI's amount due is rounded to the cent here**, half up, from the order total and its prepayment percentage. It does not read the synthetic payments, so a change to how those are rounded (P-33) does not move a file. If the rule ever moves into the synthetic data, the committed-file test fails until `pnpm docs:generate` is run.
- **Uncertain means one thing.** The 0.9 and 0.7 cut-offs that the web app's confidence badge used now live in `packages/shared` (`CONFIDENCE_HIGH`, `confidenceBand`, `isUncertain`), and the badge and the ground truth both read them. The number of uncertain fields on a PO is read from the order's own task title ("Confirm the 3 uncertain fields"), so the documents cannot disagree with the inbox.

## Fonts

Geist (Regular, SemiBold, Mono) and PT Serif (Regular, Bold) are committed in `packages/synthetic-documents/fonts` with their SIL Open Font Licence texts. They are the same open fonts the web app uses and a serif for the letter layout.

## Consequences

- A layout that does not fit one page, or a second page it does not draw, throws. The first twelve files all fit. Long orders that flow onto more pages are listed under P-21.
- The package is built by `pnpm build` and tested by `pnpm test`, and never regenerates the files: `pnpm docs:generate` does, and a test fails when the committed files differ from a fresh run.
- Positions are in fractions of an A4 page (595.28 by 841.89 points), from the top-left corner, which is the shape `provenance.box` in `packages/shared` already holds.
