# Prompt 014: what Azri was waiting for

Richie's messages of 26 Nov 2026. He pasted Azri's list of what area 2 was waiting for and asked for it to be taken care of. The list is Azri's and is summarised here. Richie's own words are quoted as he typed them.

Azri's four lines: #368 waits for Angelyn's second review; #371 and #372 wait for a review; #251 point 4, the short-stock hold, waits for Richie's answer; #251 point 5, what a new PO version changes, waits for area 1's P-89.

```text
Azri sent me this, can you take care of this? Please continue with your work.
```

Later that night he was shown the plan and three things that needed his yes: the backlog change, the order of the stories, and the release tag.

```text
Yes to all.
```

## What came of it

- **The three pull requests.** #371 and #372 had Richie's approval since 24 Nov. What held them was `main`: a trial merge in a scratch copy, aborted afterwards, named the one file each conflicts in, and Azri was told. #368 conflicts in four files, and Angelyn's second review is the one it waits for.
- **The short-stock hold (#251, point 4).** Answered from ADR 0049 decision 2 and `CLAUDE.md`: a short order is held for the customer's revision, with no SPR on the order's path. The hold and the cancel can be built now, beside today's path, until P-90 switches the screens. Two questions for Spectra were found missing from the list and are added with P-89: a held order the customer never answers, and stock that arrives during a hold.
- **PO versions (#251, point 5, and P-89).** Five readers mapped what is built around orders in all four areas, two planners wrote a plan each from the same maps, and a judge attacked both. P-89 named P-51 and P-55 but needs neither. What it needs was missing: nothing submits an order made on the form, and no such order reaches the workflow. The order is now P-113 (the PO version contract, #404), P-114 (Submit an order), then P-89. The plan is on #227.
- **The backlog (#405).** `scripts/github/data/backlog.json` says the above, and the two rendered pages follow it.
- **The tag.** `v0.1-proposal` was never cut. It now marks `321a6bf2`, the version shown on 17 Nov, which is in `main`'s history.
