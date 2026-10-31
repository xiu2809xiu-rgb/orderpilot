# Design thinking

How OrderPilot's design starts from the people who handle Spectra's orders. This is M1, design thinking. It is a starting point for the team: T-6 (Sprints 2 and 3) takes it forward after the briefing call, and the owners add their own findings.

Everything here is built from the brief, before we have met Spectra's staff. Treat each persona, pain and hypothesis as a guess to test, not a finding.

## The method

We follow the five stages of design thinking, in two rounds: once now from the brief, and again after the briefing call with what Spectra tells us.

| Stage     | What we do                                                                           | Where it lives                                                                                 | Status                       |
| --------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| Empathise | Read the brief, list the roles, and ask Spectra about each step at the briefing call | [Personas](personas.md), [the questions](../client/questions-for-client.md)                    | From the brief; T-2 next     |
| Define    | Map today's sales flow and its pains, and find the root cause                        | [Journey maps](journey-maps.md), [the problem statement](../problem-statement.md#4-root-cause) | From the brief               |
| Ideate    | Turn the pains into "how might we" questions, and choose ideas against the AI rules  | [How might we](how-might-we.md)                                                                | First set                    |
| Prototype | The UI prototype across the four areas, on synthetic data                            | T-4, in Sprint 3                                                                               | Planned                      |
| Test      | Test each hypothesis, and time the work manual against OrderPilot                    | [Hypotheses](hypotheses.md), [success metrics](success-metrics.md)                             | Protocol written; runs later |

## Rules we keep while designing

- **Spectra's staff are the users.** Customers, vendors and forwarders never log in, so their needs reach OrderPilot through Spectra's staff.
- **AI reads, rules decide, people approve.** An idea where the AI approves, posts, releases goods or pays is out, however useful it looks.
- **Evidence over opinion.** A persona or a pain changes when Spectra's answers or a test say so. Record the change and its source.
- **Synthetic data only,** in prototypes and tests alike.

## After the briefing call

1. Update each persona's "today" from what Spectra said, and mark what was confirmed.
2. Redraw today's journey with the real order timeline (request 3 in [the questions](../client/questions-for-client.md#ask-for-these-first)).
3. Re-rank the "how might we" questions by what costs Spectra most.
4. Fill in the baselines in [the success metrics](success-metrics.md), or record that there are none.
