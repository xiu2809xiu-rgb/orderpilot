# ADR 0023: ExcelJS for the data table's Excel export

- **Status:** Accepted
- **Date:** 2026-11-01
- **Story:** P-12

## Context

Every list in OrderPilot needs to leave the screen as a spreadsheet: the client's team works in Excel, and the small-business pattern in prompt 002 section 5.2 asks for "CSV and Excel export" on the common data table. CSV alone is not enough, because Excel opens a CSV without types, and a person who wants a real `.xlsx` has to convert it by hand.

The web app has a gzipped budget of 250 KB for the JavaScript a first visit downloads (ADR 0013). An Excel library is far larger than that on its own. Spreadsheet files also carry a known attack: a cell that starts with `=`, `+`, `-` or `@` is run as a formula when the file is opened.

## Decision

1. **ExcelJS 4.4.0, pinned exactly,** in `apps/web`. It writes `.xlsx` in the browser with no server round trip. It is the library the template engine in area 1 (B-3) is planned to use on the server, so the team learns one API.
2. **Loaded on demand.** `export/excel.ts` calls `import("exceljs")` when someone chooses "Export as Excel". The bundler puts it in its own chunk (about 930 KB, 256 KB gzipped) that no page loads at start-up, so it is outside the entry budget. `pnpm budget` still measures only the entry, and still passes.
3. **One cell function for both formats.** `exportCell` puts an apostrophe in front of any text that starts with `=`, `+`, `-`, `@`, a tab or a carriage return, and leaves numbers and booleans alone, so a real -5 stays a number. CSV and Excel both use it. Tests cover each starting character, quoting in CSV, and reading an `.xlsx` back.
4. **What is exported.** The columns on screen that have an `exportValue`, and either the rows on this page or, when the page passes `loadRows`, every row that matches the current search and filters. The server stays the owner of the data: a large export is a server job in a later story, and the table's menu says when it only holds the current page.
5. **The CSV carries a byte order mark,** so Excel reads UTF-8 correctly.

## Consequences

- The first Excel export downloads about 256 KB gzipped once, then the browser caches it.
- ExcelJS has not had a release since December 2024 and its Node-side dependencies (archiver, unzipper, fast-csv, tmp) include some deprecated packages (`uuid` 8, `glob` 7). Vite uses ExcelJS's prebuilt browser file, so none of them ship to the browser. The dependency scan still sees them: if it raises an advisory that no fix reaches, it is triaged as `docs/security/security-testing.md` says.
- A strict CSP (ADR 0015) does not block it. The screenshot run downloads a real `.xlsx` from a production build with the CSP on and sees no violation.
- Replacing it later means changing `excel.ts` only.
- Not done: styled columns, number formats and column widths. Add them when a client asks for them.
