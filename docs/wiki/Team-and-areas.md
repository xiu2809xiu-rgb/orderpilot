# Team and areas

Richie, the team lead, builds the base for every area. Each owner then takes over their own, and the team works sprint by sprint, by tasks. 85% of the marks are individual, so ownership must be obvious.

## The areas

| Area                                 | Label                                   | Owner    | Backup owner  | Builds                                                                                                                  |
| ------------------------------------ | --------------------------------------- | -------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1. Document AI and integration       | `area: 1 document AI and integration`   | Richie   | TBD until T-1 | The whole AI pipeline, intake, documents and orders data, master data, connectors, the platform and the 3D scene        |
| 2. Order workflows and approvals     | `area: 2 order workflows and approvals` | Azri     | TBD until T-1 | The workflows on his state machine, tasks, SPR approval, the payment gate, reminders and generated documents            |
| 3. Checks, tracker and insights      | `area: 3 checks, tracker and insights`  | Iok Teck | TBD until T-1 | The checks engine, the exceptions queue, the tracker and the KPIs                                                       |
| 4. Controls, security and monitoring | `area: 4 controls and monitoring`       | Angelyn  | TBD until T-1 | The authorisation policy, bank-detail control, masking, audit, data-to-AI rules, observability, clickstream and AI cost |

Work that belongs to the whole team carries `area: team`.

## How the areas connect

- Order status lives only in area 2's state machine.
- Area 3 reports pass or fail to area 2.
- Area 4's policy is enforced on the server, and endpoints call it.
- The AI pipeline stays whole in area 1.
- The team agrees the order and event contract together in Week 3.

## Code owners

`.github/CODEOWNERS` holds placeholders until T-1. Then each area's paths go to its owner, its backup owner and Richie, and shared files go to Richie and the backup owners, so that nobody ever waits on their own approval.

## The module

| Week | Assessment                                              | Weight          |
| ---- | ------------------------------------------------------- | --------------- |
| 5    | Proposal                                                | 25%             |
| 7    | Mock job interview: each member explains their own code | 15%, individual |
| 13   | Technical review                                        | 25%             |
| 18   | Final                                                   | 35%             |

Every feature traces to at least one of the six module requirements: M1 design thinking, M2 GRS by design, M3 AI-assisted coding, M4 best practices, M5 team Git workflow, and M6 deploy and monitor.
