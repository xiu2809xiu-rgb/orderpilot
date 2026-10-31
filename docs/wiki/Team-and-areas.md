# Team and areas

Richie, the team lead, builds the base for every area. Each owner then takes over their own, and the team works sprint by sprint, by tasks. 85% of the marks are individual, so ownership must be obvious.

## The areas

| Area                                 | Label                                   | Owner    | Backup owner | Builds                                                                                                                  |
| ------------------------------------ | --------------------------------------- | -------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 1. Document AI and integration       | `area: 1 document AI and integration`   | Richie   | Angelyn      | The whole AI pipeline, intake, documents and orders data, master data, connectors, the platform and the 3D scene        |
| 2. Order workflows and approvals     | `area: 2 order workflows and approvals` | Azri     | Iok Teck     | The workflows on his state machine, tasks, SPR approval, the payment gate, reminders and generated documents            |
| 3. Checks, tracker and insights      | `area: 3 checks tracker and insights`   | Iok Teck | Azri         | The checks engine, the exceptions queue, the tracker and the KPIs                                                       |
| 4. Controls, security and monitoring | `area: 4 controls and monitoring`       | Angelyn  | Richie       | The authorisation policy, bank-detail control, masking, audit, data-to-AI rules, observability, clickstream and AI cost |

Work that belongs to the whole team carries `area: team`.

## Your first stories

Each of areas 2, 3 and 4 starts with three stories at Ready on the board, planned for `Sprint 02 (W3)`. Their owners start on Monday 2 Nov, refine them, and at the handover prompt 004 writes the rest of each area's stories from the owners' notes. The [backlog](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/docs/agile/backlog.md#ready-to-pull) has their acceptance criteria.

| Area        | Stories                                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2, Azri     | C-2 the order state machine for the sales flow; C-3 SPR approval within limits; C-4 reminders and escalations                                             |
| 3, Iok Teck | D-2 the packing-list quantity check against the PO; D-3 the exceptions queue flow; D-4 the tracker's status, owner and overdue flags from workflow events |
| 4, Angelyn  | F-3 the authorisation policy with approval limits; F-4 no self-approval and segregation of duties; F-5 the bank-detail hold                               |

## How the areas connect

- Order status lives only in area 2's state machine.
- Area 3 reports pass or fail to area 2.
- Area 4's policy is enforced on the server, and endpoints call it.
- The AI pipeline stays whole in area 1.
- The team agrees the order and event contract together in Week 3.

## Code owners

`.github/CODEOWNERS` is filled in (T-1). Each area's paths go to its owner, its backup owner and Richie (area 1: Richie and Angelyn), and shared files go to all four. The handles are `xiu2809xiu-rgb` (Richie), `MaineJermaine` (Azri), `ITnyp` (Iok Teck) and `angelynnmr` (Angelyn).

## The module

| Week | Assessment                                              | Weight          |
| ---- | ------------------------------------------------------- | --------------- |
| 5    | Proposal                                                | 25%             |
| 7    | Mock job interview: each member explains their own code | 15%, individual |
| 13   | Technical review                                        | 25%             |
| 18   | Final                                                   | 35%             |

Every feature traces to at least one of the six module requirements: M1 design thinking, M2 GRS by design, M3 AI-assisted coding, M4 best practices, M5 team Git workflow, and M6 deploy and monitor.
