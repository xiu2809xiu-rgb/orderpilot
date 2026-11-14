# Area 2, prompt 006: polishing the Product manager and Management approver pages

No story owns this: it is UI polish for the proposal demo, after [area2-005](area2-005-ui-admin.md) did the System admin. Azri's prompts are quoted as typed, and the rest is summarised.

## 1. The Product manager

```text
idk man i just want to move on to the second role's UI just for now. lets focus on that first
```

The AI signed in as the Product manager on a Docker build of the branch, screenshotted every page and tab, and listed the weaknesses page by page.

```text
ya please fix the necessary ones first. since the entirity of the product manager role is mine. nobody else would or should be editing it in my place. any problems with the UI that 'belong' to anybody else, just fix it right then and there as it is now my responsibility
```

```text
okay please fill in the data with sample data pls then
```

The AI put the facts an SPR is decided on first (stock, the 3-month run rate, months of cover, who decides), made the task rows compact, gave the order page Timeline, Checks and Documents tabs fed by sample data, and hid the columns that pushed the tables wide.

## 2. The Management approver

Asked what Home's one-click Approve on an SPR should do, Azri picked "Review": it opens the SPR page, so the approver always sees the request and writes a comment.

```text
yup please do that
```

The AI screenshotted every approver page and the detail pages behind them, and listed the weaknesses, with two decisions for Azri: whether the approver may see item cost, and clearing the test orders from the demo database.

```text
yah im fine with those
```

The AI gave My tasks one name and SPR rows that say what they buy, made Reminders compact and opening the SPR, and gave the SPR page its due date, a history and links. It showed item cost to the approver, gave the sample order page real dates and sensible look-alikes, named permissions in words on Settings, and dropped an empty column on the vendor page.

## What the AI found that shaped it

The approver's inbox and reminders come from the daily synthetic set, while "Sent to you" comes from database tasks seeded days earlier, so its dates lag until the database is reset. The SPR page showed the approver a cost that the item page hid from them. Every sample step sat on the order date from 4 pm, which made new orders' steps "in 2 hours". Real brand names in the data are not a fault: ADR 0051 decided them.
