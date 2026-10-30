# ADR 0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-1

## Context

Four people build OrderPilot over one semester, and 85% of the marks are individual. A decision made in a chat or a review thread is easy to lose. Later stories need to know why the code is the way it is, and each owner must be able to explain the decisions behind their area at the Week 7 interview.

## Decision

We record each significant decision as an Architecture Decision Record (ADR) in `docs/adr/`.

- **When:** a story writes an ADR when it makes a decision, in the same pull request. A decision means choosing a tool, a pattern or a boundary, or accepting a trade-off that someone will later ask about.
- **Name:** `NNNN-short-title.md`, numbered in order from 0001. This repository numbers its own ADRs.
- **Contents:**
  - a title, `ADR NNNN: The decision`;
  - the status, the date and the story;
  - **Context:** the facts and pressures behind the decision;
  - **Decision:** what we decided, in plain words;
  - **Consequences:** what gets easier, what gets harder, and what we accept.
- **Status:** one of Proposed, Accepted, Superseded by ADR NNNN, or Deprecated.
- **Changes:** an accepted ADR's decision is never rewritten. A changed decision gets a new ADR, and the old one's status points to it. A dated note may be added when a later fact needs recording.

## Consequences

- Anyone can find why a choice was made without searching chats.
- Each owner has a written record to explain their area from.
- Each decision costs a little extra writing in its pull request.
- The ADRs are only useful if we keep writing them, so the Definition of Done asks for one whenever a story makes a decision.
