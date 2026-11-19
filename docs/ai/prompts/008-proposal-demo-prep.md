# Prompt 008: preparing the build for the proposal presentation

This is a summary written afterwards, not the session's transcript. Only the lines in the block below are quoted as the lead typed them. It belongs to issue 285, "Bring the build shown at the proposal presentation to main".

```text
Priority: a flow that works, then the run sheet, then the screenshots, then the test results.
Fix only what the demo path needs.
No new features, no refactors, no dependency upgrades, no schema changes unless a blocker needs one. Never loosen a server-side permission check to make the demo easier.
Merge nothing into main tonight unless its checks and owner review happen the normal way.
No AI attribution anywhere
No em dashes in repo files or UI text.
Synthetic data only.
```

## The rest, in a few sentences

The demo had to run on one laptop without the network, so the build ships with scripts to start it, to put its data back and to check it, and everything it needs is local. Later that night the lead asked for a more striking entrance and a soft effect at each press, which became the sign-in scene, Home's first view and the click ring.

## What the AI did

It built an opt-in storyline in the synthetic data, the upload preview that opens the document its file is named after, its reading pass, Home's first view, the sign-in scene and the click ring. It replayed the run sheet in a browser and listed what it found and did not fix. The lead chose what to fix and what to leave, and presented the build on 17 Nov.
