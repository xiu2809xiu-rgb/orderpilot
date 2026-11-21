# Prompt 009: the presentation feedback

Richie's message of 20 Nov 2026, three days after the proposal presentation. Its first paragraph, about which build to keep working from, is summarised. The rest is quoted as he typed it, except that its two long dashes are written as commas, because this repository allows none.

The first paragraph, in short: the team presented from a local build, and the work carries on from that version.

```text
Also, from the presentation feedback we were given: the first thing is that 9 roles are too many. It is not good for demoing the user flow, so the UX is bad, and we need to cut it down to 6 or 7, since the problem statement stated 6, try to stick around 6 as much as possible. The second thing is that the UI in the layout needs to be more intuitive; right now it just looks nice, and we need to care about UX too.

So please get the feedback addressed, and then focus on ensuring my features work perfectly and tweaking the UI to be more intuitive. Just try to improve the UI as you go, it doesn't need to be fancy, just smooth UX, and keep working on my own features, making sure everything works, and works perfectly.
```

## What came of it

- Seven independent checks of the presented build on freshly reset demo data: two read the code for what a cut of the roles touches, three judged how easy the layout is to follow, and two tested area 1's features for defects.
- The stories that followed, each with its own issue and pull request: the presented build brought to main (#285), the entrance in flow order (#286), a search that finds records (#287), Home that leads with the next act (#288), the Spark panel (#289), and the two advisories that had started to fail every pull request (#295).
- The findings in the other areas went to their owners as issues (#290, #291, #292), and the cut of the roles became a plan with six decisions for the team (#293).
