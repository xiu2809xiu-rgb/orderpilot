# Area 2, prompt 005: polishing the System admin pages

No story owns this: it is UI polish for the proposal demo. Azri's prompts are quoted as typed, and the rest is summarised.

## 1. The review

```text
okay so like we have proposal in like 4 days, so now we are mainly focusing on the UI and making it look better so that we can demo it to our teachers. richie assigned me 3 roles, and those roles are the first three in the role selection dropdown. lets work on the first of those roles, the very top. are you able to map out how the UI for each tab for that role can be improved upon by naming its weaknesses?
```

The first role is System admin. The AI signed in as it on a stack built from `main`, screenshotted its six pages and the eight tabs inside them, and listed the weaknesses page by page, with five to fix first.

## 2. The fixes

```text
okay, forget about my other teammates for now. they are not touching my parts during this phase. lets create a new branch to edit the UI with what we've found first. once you make the branch, you can start on fixing these issues and/or weaknesses you found
```

The AI fixed the Home rules card, added a health card and a route behind it, a search and a safe own row on Users, a matrix that fits nine roles, folded audit filters and short ids, Monitoring opening on Observability, and labels on Clickstream, Settings and Data sent to AI. It rebuilt the stack and screenshotted again after each round. It added tests for the new behaviour and broke the code on purpose to see each one fail. One test missed a down service drawn green, so it gained a check on the colour.

## 3. Merging

```text
is this ready to merge?
```

```text
push and open the prs
```

## What the AI found that shaped it

The rules card showed the guesses the 5 Nov briefing replaced. The readiness check is not reachable through the web server, so an admin-only route runs it. The Data scope dropdowns, not the role headers, kept the matrix too wide. A rebuild of only the web container takes under a minute, where a full one takes ten.
