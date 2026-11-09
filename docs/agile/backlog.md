# Backlog

Rendered from [`scripts/github/data/backlog.json`](../../scripts/github/data/backlog.json) by `node scripts/github/render-docs.mjs`. Change the data, not this file. The same data seeds the issues. The board shows where each story stands.

There are 9 epics and 156 stories. Estimates are story points: a first guess, for the team to change at planning.

## Epics

| Epic   | Title                             | Area                                    | Stories | Points |
| ------ | --------------------------------- | --------------------------------------- | ------- | ------ |
| Epic P | The platform base                 | `area: 1 document AI and integration`   | 93      | 531    |
| Epic A | Document intake and AI extraction | `area: 1 document AI and integration`   | 8       | 55     |
| Epic B | Master data and Business Central  | `area: 1 document AI and integration`   | 7       | 35     |
| Epic C | Order workflows and approvals     | `area: 2 order workflows and approvals` | 9       | 50     |
| Epic D | Checks, the tracker and insights  | `area: 3 checks tracker and insights`   | 5       | 31     |
| Epic E | AI with a person in the loop      | `area: 1 document AI and integration`   | 13      | 73     |
| Epic F | Financial controls and governance | `area: 4 controls and monitoring`       | 10      | 43     |
| Epic G | Monitoring                        | `area: 4 controls and monitoring`       | 2       | 11     |
| Epic T | Team stories                      | `area: team`                            | 9       | 36     |

## Ready to pull

The starter stories for areas 2, 3 and 4. Their owners start on them on Monday 2 Nov and refine them, and at the handover prompt 007 writes the rest from the owners' notes. They sit at Ready on the board.

| Story | Title                                                              | Area                                    | Points |
| ----- | ------------------------------------------------------------------ | --------------------------------------- | ------ |
| C-2   | The order state machine for the sales flow                         | `area: 2 order workflows and approvals` | 8      |
| C-3   | SPR approval within limits                                         | `area: 2 order workflows and approvals` | 5      |
| C-4   | Reminders and escalations                                          | `area: 2 order workflows and approvals` | 5      |
| D-2   | The packing-list quantity check against the PO                     | `area: 3 checks tracker and insights`   | 5      |
| D-3   | The exceptions queue flow                                          | `area: 3 checks tracker and insights`   | 5      |
| D-4   | The tracker's status, owner and overdue flags from workflow events | `area: 3 checks tracker and insights`   | 5      |
| F-3   | The authorisation policy with approval limits                      | `area: 4 controls and monitoring`       | 5      |
| F-4   | No self-approval and segregation of duties                         | `area: 4 controls and monitoring`       | 3      |
| F-5   | The bank-detail hold                                               | `area: 4 controls and monitoring`       | 5      |

## In pull order

Whoever is free pulls the next ready story from the top: Must, then Should, then Could, then continuous work. During the base, work through the stories in order, without waiting between them.

| Story | Title                                                              | Priority | Points | Area                                    | Requirements                                                   |
| ----- | ------------------------------------------------------------------ | -------- | ------ | --------------------------------------- | -------------------------------------------------------------- |
| P-1   | Ground rules                                                       | must     | 5      | `area: team`                            | M3 AI-assisted coding, M4 best practices, M5 team Git workflow |
| P-2   | GitHub as code                                                     | must     | 8      | `area: team`                            | M4 best practices, M5 team Git workflow                        |
| P-3   | The problem, the research and the questions                        | must     | 8      | `area: team`                            | M1 design thinking, M2 GRS by design                           |
| P-4   | The four areas                                                     | must     | 5      | `area: team`                            | M4 best practices, M5 team Git workflow                        |
| P-5   | Monorepo and tooling                                               | must     | 5      | `area: team`                            | M4 best practices, M5 team Git workflow                        |
| P-6   | CI and the security baseline                                       | must     | 5      | `area: team`                            | M2 GRS by design, M4 best practices, M5 team Git workflow      |
| P-7   | Shared contracts                                                   | must     | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-8   | The API shell                                                      | must     | 5      | `area: 1 document AI and integration`   | M4 best practices, M6 deploy and monitor                       |
| P-9   | Database, Redis, document storage and the local stack              | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-10  | Sign-in and sessions                                               | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-11  | The web shell                                                      | must     | 8      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-12  | Common components                                                  | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-13  | Docker images and the IaC scan                                     | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices, M6 deploy and monitor     |
| P-14  | End-to-end smoke                                                   | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-15  | Events, queues and live updates                                    | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-16  | Diagrams as code                                                   | must     | 3      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-17  | The AI gateway                                                     | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-18  | Document intake and storage                                        | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-19  | Mock Business Central and synthetic master data                    | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-20  | The connector framework and the Business Central adapter           | must     | 8      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-21  | Synthetic documents                                                | must     | 13     | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| C-1   | Area 2 base, the workflow module                                   | must     | 8      | `area: 2 order workflows and approvals` | M4 best practices                                              |
| C-2   | The order state machine for the sales flow                         | must     | 8      | `area: 2 order workflows and approvals` | M4 best practices                                              |
| C-3   | SPR approval within limits                                         | must     | 5      | `area: 2 order workflows and approvals` | M2 GRS by design, M4 best practices                            |
| C-4   | Reminders and escalations                                          | must     | 5      | `area: 2 order workflows and approvals` | M4 best practices                                              |
| D-1   | Area 3 base, checks and the tracker                                | must     | 8      | `area: 3 checks tracker and insights`   | M4 best practices                                              |
| D-2   | The packing-list quantity check against the PO                     | must     | 5      | `area: 3 checks tracker and insights`   | M4 best practices                                              |
| D-3   | The exceptions queue flow                                          | must     | 5      | `area: 3 checks tracker and insights`   | M2 GRS by design, M4 best practices                            |
| D-4   | The tracker's status, owner and overdue flags from workflow events | must     | 5      | `area: 3 checks tracker and insights`   | M4 best practices                                              |
| F-1   | Area 4 base, access policy and masking                             | must     | 8      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| F-2   | Area 4 base, the audit viewer                                      | must     | 3      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| F-3   | The authorisation policy with approval limits                      | must     | 5      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| F-4   | No self-approval and segregation of duties                         | must     | 3      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| F-5   | The bank-detail hold                                               | must     | 5      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| G-1   | Area 4 base, monitoring                                            | must     | 8      | `area: 4 controls and monitoring`       | M2 GRS by design, M6 deploy and monitor                        |
| P-22  | The design system with the Pro kits                                | must     | 8      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-24  | Cloud deployment                                                   | must     | 8      | `area: 1 document AI and integration`   | M4 best practices, M6 deploy and monitor                       |
| P-25  | Slides as code                                                     | must     | 3      | `area: team`                            | M4 best practices                                              |
| P-26  | Generated API hooks and mocks                                      | must     | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-28  | Replace the accepted glob advisory with an override                | must     | 1      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-31  | Data that looks real                                               | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-32  | The consent card                                                   | must     | 2      | `area: 4 controls and monitoring`       | M4 best practices, M6 deploy and monitor                       |
| P-33  | Home pages that work                                               | must     | 8      | `area: 1 document AI and integration`   | M4 best practices, M5 team Git workflow                        |
| P-34  | Sign-in that sells it                                              | must     | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-35  | Master data                                                        | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-36  | Orders: the reader and the list                                    | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-37  | Document intake and the inbox                                      | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-38  | The task inbox on the templates                                    | must     | 8      | `area: 2 order workflows and approvals` | M4 best practices, M5 team Git workflow                        |
| P-39  | Module navigation, showing only what is real                       | must     | 2      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-40  | The bar for every screen: dense tables, keys and actions           | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-42  | Plan prompt 004                                                    | must     | 2      | `area: 1 document AI and integration`   | M4 best practices, M5 team Git workflow                        |
| P-43  | Records open as tabs                                               | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-44  | List template: filter bar, action bar and status chip              | must     | 8      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-45  | List template: grid, saved views and operation log                 | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-46  | Form kit                                                           | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-47  | Document form                                                      | must     | 8      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-48  | Lines grid                                                         | must     | 8      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-49  | New order and draft editing                                        | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-50  | Submit, cancel and copy an order                                   | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-51  | The one order page                                                 | must     | 8      | `area: 1 document AI and integration`   | M3 AI-assisted coding, M4 best practices                       |
| P-52  | Demo documents                                                     | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-53  | Mock AI and the review fields                                      | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-54  | Document preview and highlight                                     | must     | 8      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-55  | An order from a confirmed PO                                       | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-56  | Pins, to-dos and reminders: the records                            | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-57  | Pin to top, Remind me and Add to my to-dos                         | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-58  | The My work panel                                                  | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-59  | Personal reminders fire                                            | must     | 8      | `area: 1 document AI and integration`   | M4 best practices, M6 deploy and monitor                       |
| P-60  | SPR drafts and the SPR list                                        | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-61  | The SPR form                                                       | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-62  | Payment confirmations                                              | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-63  | Shipments                                                          | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-64  | Users                                                              | must     | 5      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| P-65  | Roles                                                              | must     | 8      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| P-66  | Approval limits form                                               | must     | 5      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| P-67  | Check tolerance and reminder rule forms                            | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-68  | Change requests for master data                                    | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-69  | Mock Business Central Demo data page                               | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-70  | Pick and pack, and Proforma invoices                               | must     | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-71  | One status system everywhere                                       | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-72  | SPR approval on the templates                                      | must     | 3      | `area: 2 order workflows and approvals` | M4 best practices, M5 team Git workflow                        |
| P-73  | Exceptions on the templates                                        | must     | 3      | `area: 3 checks tracker and insights`   | M4 best practices, M5 team Git workflow                        |
| P-74  | Tracker and KPIs on the templates                                  | must     | 5      | `area: 3 checks tracker and insights`   | M4 best practices, M5 team Git workflow                        |
| P-75  | Audit log on the template                                          | must     | 3      | `area: 4 controls and monitoring`       | M4 best practices, M5 team Git workflow                        |
| P-76  | Governance and monitoring on the templates                         | must     | 5      | `area: 4 controls and monitoring`       | M4 best practices, M5 team Git workflow                        |
| T-1   | Owners, backups and reviews                                        | must     | 2      | `area: team`                            | M5 team Git workflow                                           |
| T-2   | The briefing call with Spectra                                     | must     | 2      | `area: team`                            | M1 design thinking                                             |
| T-3   | The project plan                                                   | must     | 3      | `area: team`                            | M5 team Git workflow                                           |
| T-4   | The UI prototype across the four areas                             | must     | 8      | `area: team`                            | M1 design thinking, M4 best practices                          |
| T-5   | The proposal deck and presentation                                 | must     | 5      | `area: team`                            | M1 design thinking, M2 GRS by design                           |
| T-6   | Design thinking                                                    | must     | 5      | `area: team`                            | M1 design thinking                                             |
| T-7   | GRS by design                                                      | must     | 5      | `area: team`                            | M2 GRS by design                                               |
| T-8   | Preparing for the mock interview                                   | must     | 3      | `area: team`                            | M3 AI-assisted coding, M4 best practices                       |
| T-9   | The handover                                                       | must     | 3      | `area: team`                            | M5 team Git workflow                                           |
| A-1   | Classification                                                     | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| A-2   | Extraction with confidence and provenance                          | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| E-1   | The review screen, with source highlighting                        | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| E-2   | The accuracy harness, with a 95% target and a comparison of models | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-78  | Room in the entry bundle                                           | must     | 3      | `area: 1 document AI and integration`   | M4 best practices, M6 deploy and monitor                       |
| P-81  | Settle into the private repository                                 | must     | 2      | `area: 1 document AI and integration`   | M4 best practices, M5 team Git workflow                        |
| P-82  | Plan prompts 005 and 006                                           | must     | 2      | `area: 1 document AI and integration`   | M4 best practices, M5 team Git workflow                        |
| P-83  | Rename Navision to Business Central                                | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-84  | SPR, the approver group and zero tolerance in the facts            | must     | 3      | `area: 1 document AI and integration`   | M1 design thinking, M2 GRS by design                           |
| P-85  | Record the 5 Nov briefing                                          | must     | 2      | `area: team`                            | M1 design thinking                                             |
| P-86  | Synthetic data from the briefing                                   | must     | 13     | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-87  | Drafts that a person sends                                         | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-88  | Customer check on intake and the new-customer card                 | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-89  | PO versions                                                        | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-90  | The short-stock revision request                                   | must     | 3      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-91  | The compare screen                                                 | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-92  | Document cabinet: filing and search                                | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-93  | Cabinet viewer: stamps, notes and the related chain                | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-94  | Audit packs                                                        | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-95  | Spark's foundation                                                 | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M3 AI-assisted coding, M4 best practices     |
| P-96  | Spark's panel and page                                             | must     | 8      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-97  | Spark finds documents                                              | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-98  | Spark matches a set and collects an audit pack                     | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-99  | Spark answers order questions                                      | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-100 | SPR screens: routing, the 24-hour reminder and where it is stuck   | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-101 | Vendor POs                                                         | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-106 | Three visual directions                                            | must     | 8      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-107 | Roll the picked direction onto the shell and templates             | must     | 8      | `area: 1 document AI and integration`   | M4 best practices                                              |
| C-5   | Area 2 polish left out of the base                                 | should   | 3      | `area: 2 order workflows and approvals` | M4 best practices                                              |
| P-23  | The 3D order constellation                                         | should   | 13     | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-29  | A unit coverage threshold on domain logic                          | should   | 2      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-30  | A k6 smoke load test                                               | should   | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-41  | Finish the bar on every list and detail page                       | should   | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| A-3   | Layout mapping, proposed by AI and approved by a person            | should   | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| A-4   | Learning from corrections, one layout at a time                    | should   | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| A-5   | Email intake through a mock mailbox with signed webhooks           | should   | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| B-1   | Duplicate-PO protection                                            | should   | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| B-2   | A Business Central import file                                     | should   | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| B-3   | The template engine for PIs, invoices, packing lists and Excel     | should   | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| E-3   | Prompt-injection tests                                             | should   | 3      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| F-6   | A non-owner runtime database role                                  | should   | 3      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| P-102 | Inbound shipments and chase drafts                                 | should   | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-103 | Goods receipt and inwarding                                        | should   | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-104 | Vendor payments by due date                                        | should   | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-105 | Spark's charts, forecast and customer replies                      | should   | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-108 | The landing page                                                   | should   | 8      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-109 | The sign-in page with the scene                                    | should   | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-110 | The speed bar                                                      | should   | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-27  | Web shell polish                                                   | could    | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-77  | Tab strip polish                                                   | could    | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-79  | End-to-end follow-ups                                              | could    | 3      | `area: 1 document AI and integration`   | M4 best practices, M6 deploy and monitor                       |
| B-4   | QR codes on generated documents and carton labels                  | could    | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| E-4   | Passkeys to confirm risky approvals                                | could    | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| E-5   | A first-run guided tour for each role                              | could    | 3      | `area: 1 document AI and integration`   | M1 design thinking, M4 best practices                          |
| E-6   | An "Ask OrderPilot" help panel that answers from our docs          | could    | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M3 AI-assisted coding                        |
| F-7   | Session hardening                                                  | could    | 5      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| F-8   | Governance base polish                                             | could    | 3      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| G-2   | Monitoring base polish                                             | could    | 3      | `area: 4 controls and monitoring`       | M2 GRS by design, M6 deploy and monitor                        |
| F-9   | Audit viewer polish                                                | could    | 3      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| P-80  | Lines grid polish                                                  | could    | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-111 | Grid polish                                                        | could    | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-112 | Small delights                                                     | could    | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |

## Epic P: The platform base

The team's way of working, the running app and area 1's core, in the order Prompt 001 sets. Richie builds it for every area.

### P-1: Ground rules

The front matter, the rules for every AI tool, the repository files, the first ADRs and the agile docs.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M3 AI-assisted coding, M4 best practices, M5 team Git workflow
- **Branch:** `docs/ground-rules`
- **Planned for:** Sprint 01 (W2)

Acceptance criteria:

- Front matter: `README.md` (what OrderPilot is, its status, and links), `CONTRIBUTING.md` (set-up, workflow and how to add a component) and `SECURITY.md` (how to report, and what we scan).
- `AGENTS.md`, for every teammate's AI tool (Kiro, Copilot, Cursor, ChatGPT): never delete or overwrite anyone's work; write only in your own area; no force pushes; risky commands (`reset --hard`, `clean`, mass formatting) only after an explicit yes; no AI tool folders committed; no attribution, synthetic data only, and keys kept out of Git; the path from a story to `main`; a starter prompt to paste at the start of each session.
- `CLAUDE.md`: the product brief, then the stack and repository layout; the engineering standards (OOP layers and patterns; no `any`; validation at boundaries; one error envelope; comments that explain why); security, performance and testing; the UI rules; the Git and AI rules; the Definition of Done.
- Repository files: `.claude/settings.json` as Richie placed it; `.editorconfig`; `.gitattributes` with LF line endings; `.gitignore` covering every `.env*` except `.env.example`, `samples/*` except its README, build output and AI tool folders; `.node-version` set to `24.22.0`.
- ADRs: `docs/adr/0001-record-architecture-decisions.md`, and `0002-a-clean-repository-for-ps11.md` with the lecturer's request, nothing from other statements, the team lead building every area's base before the owners take over, and the earlier repository read for lessons only.
- `docs/agile/`: the README; the working agreement (roles, the sprint rules, ceremonies, the board, a work-in-progress limit of two per person, a reviewer of the day, and communication); the Definitions of Ready and Done, for each story, each sprint, and each assessment release (Weeks 5, 13 and 18, each tagged).
- `docs/ai/ai-usage-log.md`: one table per area, with the platform and area 1 first.
- The prompt moved to `docs/ai/prompts/001-build-the-base.md`.
- `docs/BUILD_REPORT.md`: one short section per prompt.

### P-2: GitHub as code

The labels, sprint calendar, board, backlog and wiki kept as code, and the sprint recorder.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `chore/github-process`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-1

Acceptance criteria:

- `.github/`: issue forms for stories, tasks, epics, spikes and bugs, with blank issues off and contact links to this repository's security advisories and docs.
- `.github/`: the pull request template (rule 3, the areas, M1 to M6, a UI checklist, docs, data and security, and the Definition of Done).
- `.github/`: `CODEOWNERS`, with placeholders until T-1; `labels.json`; and `rulesets/main.json`, mirroring the live ruleset after every change.
- Labels: `type:` epic, story, task, bug, spike, chore, docs and security.
- Labels: `area: 1 document AI and integration`, `area: 2 order workflows and approvals`, `area: 3 checks tracker and insights`, `area: 4 controls and monitoring`, and `area: team`.
- Labels: `priority:` must, should and could; `req: M1` to `M6`, each with its name; `status: blocked`, `status: needs client input`, and `dependencies`.
- `scripts/github/`, all idempotent: labels.
- `scripts/github/`, all idempotent: the sprint calendar (Sprint 1 starts Monday 26 Oct 2026; each sprint is due Sunday 23:59 Singapore time).
- `scripts/github/`, all idempotent: a fresh board **OrderPilot delivery**, linked to this repository and found again only through that link, with Status (including Ready), a Sprint iteration, Estimate and Area, and Backlog and Sprint views. Project #2, `OrderPilot delivery (port attempt)`, is never touched.
- `scripts/github/`, all idempotent: the backlog as data: epics P, A to G and T, with the stories in prompts 001 and 002 and their acceptance criteria, estimates, priorities and areas, seeded as sub-issues of their epics, with every issue on the board.
- Existing issues are adopted by key, never duplicated: #1 P-1 (kept closed, in `Sprint 01 (W2)`), #2 P-2, #4 P-3, #5 P-4, #6 P-5 and #7 P-6. Adopting sets the body, the labels, the epic and the board fields.
- Three ready-to-pull starter stories each for areas 2, 3 and 4 (C-2 to C-4, D-2 to D-4 and F-3 to F-5), each with its acceptance criteria, at Ready on the board.
- `scripts/github/`, all idempotent: the rendered `docs/agile/backlog.md` and the wiki's sprint calendar.
- `scripts/github/`, all idempotent: wiki publishing.
- `.github/workflows/sprint-recorder.yml` sets an issue's milestone to the sprint of the day it closes, or of the day its pull request merges.
- `scripts/github/sprint-report.mjs` prints what closed this sprint and what is in progress, by area.
- `docs/wiki/`: Home, Getting started (what works so far), How we work, Definition of Done, Team and areas, Sprint calendar, Security, and the sidebar.
- After the merge, the scripts are run and the wiki is published. Richie groups the board's Backlog view by Sprint, which the API cannot do.

### P-3: The problem, the research and the questions

The problem in our words, what we assume, what we must ask Spectra, and the starting points for design thinking and GRS.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M1 design thinking, M2 GRS by design
- **Branch:** `docs/problem-and-questions`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-2

Acceptance criteria:

- `docs/problem-statement.md`: the brief in our words, stakeholders, pain points, root cause, constraints, scope, success metrics and open questions.
- `docs/assumptions.md`.
- `docs/client/questions-for-client.md`: the three items to ask for first (anonymised samples of every document type including the SPR form; a Business Central export; and the timeline of one real order), then the questions in priority order, and a note to send the priority questions before the briefing call.
- `docs/client/questions-for-client.md`: the six new questions in section 5.3 of prompt 002, after the existing priority questions.
- `docs/research/domain-notes.md`: section 5 of prompt 002, the domain notes, with every Business Central detail marked as an assumption to confirm at the briefing call.
- `docs/data-formats.md`: the assumed formats of every document and Business Central export, each to confirm, and how to try a client sample safely.
- `docs/agile/hero-journey.md`: the sales-pilot demo story, E2E #1 to #4, and a presenter slot for each area.
- `docs/requirements-traceability.md`: M1 to M6, planned features, where, and evidence.
- `docs/research/README.md`: where Richie's ERP notes go, in his own words only.
- `docs/design-thinking/`: the method; personas started from the role table; current and future journeys of the sales flow; how might we; hypotheses; and success metrics with a measurement protocol (time, touches and errors, manual against OrderPilot).
- `docs/grs/grs-by-design.md`: governance; a risk register (AI errors, bank-detail fraud, data leaking to AI providers, PDPA, prompt injection, ERP changes); and sustainability (less re-typing, fewer reshipments, and AI only where it helps, with its cost tracked).
- Nothing claims the prototype is PDPA compliant.

### P-4: The four areas

Who owns which paths, and a guide that lets each owner take over their area.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `docs/areas`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-3

Acceptance criteria:

- `docs/team/module-ownership.md`: the owners, the paths each area owns, the shared files and who reviews them, and backup owners (TBD until T-1).
- Four guides: `area-1-document-ai-and-integration.md`, `area-2-order-workflows-and-approvals.md`, `area-3-checks-tracker-and-insights.md` and `area-4-controls-security-and-monitoring.md`.
- Each guide covers the goal and user stories; the contracts; a recommended design (patterns, data flow, sequence); **What the base gives you** and **What's yours to build** (the A-level depth); what the owner explains at the Week 7 interview; the risks; and the module requirements it covers.

### P-5: Monorepo and tooling

The pnpm workspace, the strict shared configs, the Git hooks and the supply-chain settings.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `chore/monorepo-tooling`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-2

Acceptance criteria:

- A pnpm workspace (`apps/*`, `services/*`, `packages/*`) and root scripts.
- `packages/tsconfig` (strict) and `packages/eslint-config` (flat, type-aware, with jsx-a11y, failing on any warning).
- Prettier, commitlint (config-conventional), Dependabot (npm and Actions, weekly on Monday 06:00 Singapore time, a 7-day cooldown, grouped) and a fresh lockfile.
- Commit-message hook: commitlint.
- Pre-commit hook: the licence-key guard (the values of `REACTBITS_LICENSE_KEY` and `REUI_LICENSE_KEY` never in staged files), the samples guard, a secretlint scan, the em-dash check, and lint-staged.
- Pre-push hook: the samples guard on every commit being pushed.
- Pre-push hook: a guard that refuses any push to `main`, so the pull request rule holds on every teammate's machine, whatever GitHub enforces.
- Scripts: `scripts/check-licence-key.mjs`, `scripts/check-samples.mjs`, `scripts/check-dashes.mjs`, and `samples/README.md`.
- Supply-chain settings: exact version pins; `minimumReleaseAge`; reviewed `allowBuilds`; and overrides and ignored advisories, each with a reason and a review date.
- ADRs: pnpm monorepo; TypeScript and ESM.
- Type-check `scripts/github` under `checkJs`: the P-2 scripts are plain Node ESM with no types, so the root `tsconfig.json` excludes them today (about 800 errors). Add JSDoc types or move them to TypeScript, then remove the exclusion.

### P-6: CI and the security baseline

The verify job and the three security scans, required on every pull request from here on.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices, M5 team Git workflow
- **Branch:** `ci/verify-and-scan`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-5

Acceptance criteria:

- `ci.yml`, the `verify` job ("Lint, typecheck, test, build"): the samples history check; a frozen install; `pnpm audit --audit-level high`; format, the em-dash check, lint, typecheck, tests and build.
- `security.yml`, "SAST (Semgrep)": Semgrep with the default, TypeScript, React, Node and OWASP Top 10 rules.
- `security.yml`, "Secret scan (gitleaks)": across the full history.
- `security.yml`, "Dependency scan (OSV)": on the lockfile.
- Workflow hygiene: least-privilege `permissions`; actions pinned to commit SHAs; `concurrency` that cancels superseded runs; caching.
- No workflow-level path filters on required workflows.
- The four checks above are required from now on.
- `docs/agile/test-plan.md`: the test levels, environments and data, and a failure and edge-case matrix seeded with #11's cases, each marked planned with its story.
- `docs/security/security-testing.md`: what runs where, and the triage process (fix, or accept or dismiss with a reason and a review date).
- ADRs: the testing strategy; the DevSecOps tools.

### P-7: Shared contracts

One package of zod schemas and types that the API, the web app and the owners all build on.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-shared-contracts`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-5

Acceptance criteria:

- `packages/shared`, with zod schemas and types: the response envelope and the error envelope `{ error: { code, message, details, traceId } }`, and the error codes.
- `packages/shared`: the nine roles; the permissions the platform checks so far; the session and user reference; and the audit and AI-usage types.
- The first draft of the order and event contract: order headers and lines; documents and their types; field values with confidence and provenance; domain event names.
- OrderPilot's own record numbers: a type prefix, the date and a running number, like `SPR-20261102-0001`, shown beside Business Central's numbers, which stay the official ones.
- The contract is marked "draft for the team to agree in Week 3", and status stays in area 2.
- ADR: shared contracts.
- Contract polish: publish the schemas as JSON Schema for the Swagger page and the mock Business Central, add a contract test that fails on a breaking change, and prove the `exports` map through a Vite build once P-11 lands.

### P-8: The API shell

A layered NestJS API with typed configuration, security headers, logging, health checks and the architecture docs.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices, M6 deploy and monitor
- **Branch:** `feat/platform-api-shell`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-7

Acceptance criteria:

- NestJS, in layers: controllers, services, repositories (the only place Prisma is called) and domain classes.
- Typed configuration: a zod schema; one root `.env` is enough (load `apps/api/.env`, then the root `.env`, never overriding what the shell, CI or Docker set, and skipping missing files quietly); a clear message naming the file to create when something required is missing.
- Security: helmet with a strict CSP, a CORS allow-list and rate limiting.
- Swagger "OrderPilot API" at `/api/docs`.
- pino with correlation ids, a global exception filter and a zod validation pipe.
- `/health`, `/health/live` and `/health/ready`.
- `apps/api/requests/*.http`, Vitest, and `docs/architecture/` (README and patterns).
- ADRs: NestJS layered modules; the observability baseline.
- API shell polish: keep the rate-limit counters in Redis once P-9 lands (the built-in store is per process), make the body-size limit and request timeout settings, drain open requests on shutdown, open Swagger UI in a real browser under its CSP (checked with curl only so far), and generate response-shape tests from the OpenAPI document.

### P-9: Database, Redis, document storage and the local stack

PostgreSQL with an append-only audit trail, Redis queues, S3-compatible storage and a local stack that starts from one `.env`.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/platform-database`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-8

Acceptance criteria:

- Prisma with PostgreSQL: `User`, `RefreshToken`, `RolePermission`, and `AuditEvent` with an append-only trigger.
- The audit writer chains each event's hash to the one before it, verifies the chain, and joins the business transaction.
- Redis with BullMQ: the queue module.
- MinIO (S3-compatible) behind a storage service that uses the S3 API, so AWS S3 drops in later.
- The test harness: its own database and Redis database; a global set-up that migrates and seeds; and a data reset.
- `docker-compose.yml`: PostgreSQL, Redis and MinIO, under compose project name `orderpilot`.
- Ports from `.env`: `POSTGRES_PORT`, `REDIS_PORT` and `MINIO_PORT`, with `DATABASE_URL`, `REDIS_URL` and the test URLs built from them (dotenv-expand). Changing one line moves them all.
- `.env.example`: one root file documenting every variable with a safe default.
- The seed starts `packages/synthetic-data`: about 5 fictional customers in the brief's countries, 3 vendors, 30 items from fictional brands, opening stock, and 10 orders in different states. Every area base uses this set, and P-19 grows it.
- Getting started and `CONTRIBUTING.md` say `cp .env.example .env`, and troubleshooting covers "port already in use", "role does not exist" (another PostgreSQL answered) and Docker not running.
- Proved from a clean clone with nothing loaded in the shell, on the default ports and again with `POSTGRES_PORT=5433`.
- ADRs: Prisma with PostgreSQL; S3-compatible document storage.
- The local stack runs the `pgvector/pgvector` PostgreSQL image with the `pgvector` and `pg_trgm` extensions enabled, and Mailpit as the only place OrderPilot sends email in development and demos with an ADR, a pinned version and a traceability row (ADRs 0017 and 0018).

### P-10: Sign-in and sessions

Sessions, guards and a demo sign-in for all nine roles, with every sign-in and change audited.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/platform-auth`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-9

Acceptance criteria:

- Credentials and tokens: argon2 password hashing; a JWT access token in an httpOnly, Secure, SameSite cookie; refresh-token rotation with reuse detection; CSRF protection.
- When a session does end, the API lets the user sign back in without losing their place, so the web app can keep unsaved form input (P-11).
- A demo sign-in (`DEMO_MODE`) offering the nine roles, with synthetic names.
- Guards: a users module, plus auth, CSRF and permissions guards. The permissions guard calls the role-permission matrix, which area 4 owns.
- Seeds: a user for every role, and the default matrix.
- Audit: every sign-in, sign-out and change.
- Integration tests: 401, 403 and validation cases.
- ADR: sessions and RBAC.

### P-11: The web shell

The web app's stack, tokens, plumbing, shell and first pages, within the bundle budget.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-web-shell`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-7

Acceptance criteria:

- The stack: Vite, React 19, TypeScript and Tailwind v4, with shadcn/ui set up by its Vite guide.
- Design tokens: a warm neutral base with a deep jade accent; light and dark themes; an 8-pt spacing grid; radius and motion values; the Geist font, with tabular numbers.
- App plumbing: React Router with route guards; an `ApiClient` class; TanStack Query; a minimal Zustand store; react-i18next (English, with no hard-coded strings); React Hook Form with zod.
- When a session ends, unsaved form input is kept, and the user signs back in and carries on where they were.
- The shell: a sidebar for each role; breadcrumbs; a command palette; a theme switch; the demo role switcher; notifications and a user menu.
- Pages: the login page, plain for now; settings; a "planned" page for each area; error pages.
- Assets: a theme script that stops the wrong theme flashing, and an OrderPilot favicon.
- The bundle budget (initial JS 250 KB gzip or less, 3D excluded) joins the verify job, and components have tests with Testing Library.
- UI sources while the repository is public: shadcn/ui; Magic UI (free); React Bits (free, `@react-bits`); ReUI's free components, only if they install without the licence key.
- ADRs: the web stack; i18n with English first; CSP and inline styles.

### P-12: Common components

The shared table, page states, badges and small pieces every area's screens use.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/platform-web-components`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-11

Acceptance criteria:

- Data and layout: a data table with server-side paging, sorting, filtering and column visibility, one quick search, saved filters, column settings, and CSV and Excel export; the page header and section cards.
- The operation log at the foot of each detail page: time, user, IP and what changed, built with F-2.
- Every state: loading skeleton, empty with a next action, error with retry and a trace id, partial, and permission denied.
- Badges: "Mock", "Mock AI", "Synthetic demo data", status, and classification.
- Small pieces, with tests: a masked value with "why is this hidden"; a confidence badge that says "Requires approval"; an audit link; relative time; a copy button; the planned page.

### P-13: Docker images and the IaC scan

Non-root images for the API, the web app and the mocks, scanned in CI.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices, M6 deploy and monitor
- **Branch:** `ci/docker`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-8, P-11

Acceptance criteria:

- Images: multi-stage, running as non-root, with health checks; one for the API (with a worker entry); one for the web app (nginx with security headers and an SPA fallback); a generic one for the mock services.
- Compose: `api`, `worker` and `web` services, each waiting on its dependencies' health checks; `.dockerignore`; a samples override (a throwaway stack that only this machine can reach, for trying a client sample, deleted afterwards).
- CI: "Docker images" builds every image, then a Trivy image scan fails on fixable HIGH or CRITICAL findings; "IaC and Dockerfile scan" runs Trivy config. Both become required.
- ADR: Docker and the deployment target.
- Cache the MinIO source build (`docker/minio`) between CI runs and between rebuilds, so `docker compose up --build` does not compile it again. Left out of P-9 because the first build runs once per machine (ADR 0011).

### P-14: End-to-end smoke

A signed-in smoke test for every role, with accessibility checked, required in CI.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `test/e2e-smoke`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-10, P-11, P-13

Acceptance criteria:

- Playwright with axe, plus helpers for the demo session and the layout.
- A smoke test that signs in as each role, opens the shell and signs out, with WCAG 2.2 AA checked on every page.
- The CI job "End-to-end smoke" runs it against the compose stack, uploads the report and shows the service logs on failure. It becomes required.
- Left out of the Getting started fix (issue 102), which proved the same walk by hand: the nine-role sign-in walk as a repeatable test, a CI job that runs `pnpm local:setup` on a clean runner, and a run of Getting started on macOS (written, not yet tested there).

### P-15: Events, queues and live updates

Typed domain events, a worker process and live updates in the web app.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-events`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-9

Acceptance criteria:

- Events: a typed domain event bus, with a transactional outbox and idempotency keys.
- Workers: a BullMQ worker process.
- Live updates: an SSE stream to the web app, and a hook that listens to it.
- ADR: jobs, events and realtime.

### P-16: Diagrams as code

Mermaid sources rendered to SVG and checked in CI.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `docs/diagrams`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-9

Acceptance criteria:

- The pipeline: Mermaid sources rendered to SVG by `scripts/build-diagrams.mjs` (using Playwright's Chromium), with `diagrams:check` in CI.
- C4 context and containers.
- The sales flow and the purchase flow, showing who does what.
- The PO-to-approval sequence.
- The data model, generated from `schema.prisma`.
- Data flow, with trust boundaries and GRS controls.
- Deployment, local and on AWS.

### P-17: The AI gateway

One gateway over the AI providers, with usage tracking, a prompt-injection defence and a destination check.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-ai-gateway`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-8

Acceptance criteria:

- `LlmGateway` with three providers: mock (the default, deterministic, and works offline); OpenAI-compatible (a base URL, a key and a model, so Groq, Gemini's OpenAI-compatible endpoint, OpenRouter, NVIDIA NIM and Ollama all work by configuration alone); and optional Bedrock.
- Calls: structured output validated with zod, with retries; page images for vision models (Groq's `qwen/qwen3.8-27b` takes up to 3 images a request).
- Usage tracking: `AiUsageTracker` and `AiUsageRecord` log tokens, model, latency, estimated cost, feature, user, document and outcome, plus the data the web app needs to show its "Mock AI" badge.
- Prompt-injection defence: documents are treated as data; the model only returns fields, or asks for a read-only tool that runs as the person asking; no model output writes, approves, posts, pays or sends.
- A destination check: area 4's policy decides what data may go to which provider. The default is synthetic data only.
- Keys: Richie adds `GROQ_API_KEY` and `GEMINI_API_KEY` to the root `.env` himself.
- ADR: the AI gateway and the person in the loop.
- The Vercel AI SDK sits under `LlmGateway`, and the gateway keeps cost tracking and the data-to-AI policy with an ADR, a pinned version and a traceability row.
- Tool calling, with each tool's arguments parsed by zod, and streamed answers, with a mock provider that scripts both, so Spark (P-95) needs no second gateway.

### P-18: Document intake and storage

A safe upload API, text and image extraction, the start of area 1's order data, and the upload screen.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-document-intake`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-9, P-17

Acceptance criteria:

- Upload API: accepts PDF, PNG, JPEG, XLSX and CSV; size limits, type sniffing and a zip-bomb guard; nothing executable; stored through P-9's storage service.
- Processing: PDF text extraction (pdfjs-dist) plus page images for the vision models; duplicate detection by content hash.
- Data model: field values with confidence and provenance, on top of the orders and documents tables that P-36 and P-37 bring. Status stays in area 2.
- UI: an upload screen with drag and drop, and a documents list.
- Queue: a job that marks each document "awaiting AI" until the extraction stories.
- Prompt 003 brings forward upload, the documents list and 12 synthetic documents (P-37); this story keeps the rest: the safe upload API, extraction, content-hash duplicate detection, the data model and the queue.
- The synthetic set includes a rejected SPR and a partly shipped order, with the screens that show them (follow-up to P-31).
- Prompt 004 keeps the sample set behind `OrderDirectory` and `DocumentDirectory`, because its dates move with today, so the seed does not copy it into the order tables (ADR in P-36).

### P-19: Mock Business Central and synthetic master data

A mock of Business Central's standard API v2.0, and the synthetic master data behind it.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-mock-business-central`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-5

Acceptance criteria:

- `services/mock-business-central`: the resources of Business Central's API v2.0, named as Microsoft's reference names them (companies, customers, vendors, items, salesQuotes, salesOrders, salesInvoices, salesCreditMemos, purchaseOrders, purchaseInvoices and purchaseReceipts, with their lines), with paging and `$filter`, behind a stub of OAuth client credentials, and no price tables.
- `packages/synthetic-data` stays the source of the mock's records, and P-86 brings the briefing's brands, categories and countries.
- Customers and vendors in one list of business partners, each with a type and a price level, for the master-data screens; the price check is that the documents agree (prompt 005 section 1).
- Opening stock and opening balances (receivables and payables), growing the set P-9 starts.
- The mock follows the JSON shapes in Microsoft's API v2.0 reference, such as `number`, `displayName`, `addressLine1` and `taxRegistrationNumber` on a customer, and `docs/research/domain-notes.md` maps them to the field names in `docs/data-formats.md`.
- Realism: document numbering and statuses from Richie's notes when present.
- Tests, a compose service, `docs/api/mock-systems.md`, and a "Mock" label wherever it's used.
- ADR: mock external systems.
- Prompt 003 brings forward reading master data through a port labelled as the mock (P-35, whose label P-83 renames); this story still brings the service, its paging and `$filter`, and the compose service.
- The stock figure a lookup needs is `inventory` on `items`, as in API v2.0, and the quantities on sales and purchase orders are summed from the open lines, because `items` has neither.
- Vendor bank details have no API v2.0 resource (`bankAccounts` is the company's own), so the mock adds `vendorBankAccounts`, and `docs/api/mock-systems.md` marks it as ours and says a real connection needs a custom API page or an export.
- A write path where API v2.0 has one: POST and PATCH on customers, vendors, purchaseOrders and purchaseOrderLines, kept in the mock's own store. `purchaseReceipts` stays read-only, as in API v2.0, so the mock makes a receipt when a purchase order is received.
- Webhooks (subscriptions) come later, and `docs/api/mock-systems.md` says so.

### P-20: The connector framework and the Business Central adapter

A connector framework, and the adapter that makes a stock lookup work end to end.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Branch:** `feat/area1-connectors`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-19

Acceptance criteria:

- The framework: a `SystemConnector` interface over named record kinds (items, customers, vendors, stock levels and mail messages).
- The framework: a factory (credentials only from the environment); a health probe and a retry policy with backoff; an HTTP JSON client with timeouts; data minimisation and an offline connector; the `Connector` model and a connectors page.
- The Business Central adapter, so a stock lookup works end to end, with contract tests against the mock.
- ADR: hub-and-spoke integration.
- Moving to the real Business Central is configuration only (base URL, tenant, environment, company and OAuth client), and a test shows the adapter reads nothing else.
- A write path: the adapter writes a record only with the preview a person saw and the id of their approval, refuses otherwise, and audits both, with contract tests against the mock. P-88, P-101 and P-103 write through it.

### P-21: Synthetic documents

The rest of the generated set, with planted mistakes and ground truth for the accuracy harness. P-52 brought the package, four layouts, the CLI and twelve files forward.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 13 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-synthetic-documents`
- **Planned for:** Sprint 04 (W5) and Sprint 05 (W6)
- **Depends on:** P-52, P-86

Acceptance criteria:

- More document kinds in the same renderer, with positions and ground truth: the vendor PI, vendor invoice, vendor packing list, delivery order, AWB, bill of lading as draft and final, import permit, proof of payment and the SPR form. P-52 has the PO, PI, packing list and commercial invoice.
- Scanned-looking variants of more than one document, and long orders that flow onto further pages (a layout today refuses an order that does not fit one page).
- Planted mistakes: price, PO reference, part number and changed bank details, plus P-86's PI whose price differs from its PO and AWB draft with the wrong consignee. The quantity mismatch is P-52's packing list.
- Ground truth: a JSON file for every generated document, for the accuracy harness. P-52 writes them for its twelve.
- Delivery: P-52's `pnpm docs:generate` grows to the full set. The twelve demo files stay in `apps/web/public/demo-documents/`, not a folder called `samples`.
- `DOCUMENT_TYPES` in `packages/shared/src/order.ts` widens with the kinds it lacks (vendor invoice, delivery order, SPR form and credit note) and a draft or final marker on the AWB and bill of lading, with all four owners asked to review.

### P-22: The design system with the Pro kits

The licensed kits, set up once Richie says the repository is private and the official keys are in `apps/web/.env.local`, ready for Richie's own pages, which P-107 to P-109 upgrade.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-design-system`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-11, P-12
- **Condition:** Only once Richie says the repository is private and official keys are in `apps/web/.env.local` (rule 8 of prompt 001, confirmed in prompt 002, section 7). Until he says, free kits only. Met on 6 Nov: the repository is private (P-81) and the keys are in.

Acceptance criteria:

- Registries in `apps/web/components.json`: `@reactbits-starter`, `@reactbits-pro`, `@reui` and `@magicui`, with the licence keys sent as bearer headers from the environment. The working registries at `registry.collectui.pro` stay, as prompt 006 section 2 allows (keep what works).
- The keys stay in `apps/web/.env.local` as `REUI_LICENSE_KEY` and `REACTBITS_LICENSE_KEY`, and `components.json` refers to them only as `${...}`. No key is ever written into a file, commit or message.
- Pro parts stay in Richie's own pages: landing, sign-in, the app shell and the 3D view, plus Spark (prompt 006 section 2). The four areas' screens use the free kits unless Richie confirms a team licence.
- Each source verified with a test install, and exact errors reported.
- Tools: the React Bits skill read in full before any item is used; the shadcn MCP; ReUI's MCP server, with its token kept out of Git.
- `docs/design/reactbits-usage.md`: a plan for every page, saying which React Bits, ReUI and Magic UI items it uses, and why; 20 or more distinct items across the app; at least one item on every page; Pro blocks on landing and login; Application UI wherever it matches; only subtle items on dense work screens.
- `docs/design/design-system.md`, which names prompt 006's work mode and show mode and what belongs to each.
- `CONTRIBUTING.md`: teammates never need the keys to run or build, because added components are code in the repository. Adding a new Pro component goes through Richie.
- The Pro blocks on sign-in, landing and the app shell move to P-107 to P-109, after Richie picks a direction in P-106. Every item is adapted to the tokens, one component per file, with a header comment naming its vendor, the item and its licence.
- ADR: component registries, and why licensed code needs a private repository.

### P-23: The 3D order constellation

A live 3D view of orders moving between the teams around Spark, on landing, login and as an operations view.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 13 points
- **Requirements:** M4 best practices
- **Branch:** `feat/area1-order-constellation`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-11, P-15

Acceptance criteria:

- The concept: Spark at the core, in faceted glass with an emissive inner light that pulses when Spark answers; around it the stations (Sales and Support, Product Managers, the management approvers, the SPR coordinator, the warehouse, Finance, and Logistics and forwarders) plus Business Central and the inbox; PO, PI, invoice, packing list and AWB/BL travel as glowing packets along arcs, coloured on time, waiting or mismatch caught, from real workflow events over SSE.
- It is the landing page's hero, sits behind the sign-in page, and is a live operations view for Management, where clicking a station opens the tracker filtered to it.
- Assets: parametric Blender Python scripts in `assets-src/3d/`, with PBR materials, bevels and clean topology; run headless with `blender -b -P`; exported to GLB and quantised with glTF Transform, with no WebAssembly decoders; 1.5 MB or less in total.
- Rendering: React Three Fiber, drei and postprocessing; ACES filmic tone mapping, a studio environment and soft shadows; bloom, a subtle depth of field and a vignette; spring motion and a slow cinematic camera that the user can take over; hover tooltips, and clicking a node to navigate; React Bits overlays for labels.
- Performance and access: a lazy chunk, DPR clamped to [1, 2], and adaptive quality; pauses when off-screen or when the tab is hidden; a still frame for reduced motion, and a fallback image without WebGL; a keyboard-usable list beside the canvas; 60 fps on a mid-range laptop, reported honestly.
- ADRs: 3D assets without WebAssembly decoders; the constellation scene.
- Proof for Richie: a 20-second capture of the camera move and stills in light and dark in `docs/design/constellation/`, judged before the scene goes on landing.

### P-24: Cloud deployment

The app live on a Lightsail server over HTTPS, deployed on each merge to `main`, with roll-back and backups.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices, M6 deploy and monitor
- **Branch:** `feat/platform-deploy`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-13
- **Condition:** Only once Richie confirms step 8 of his guide.

Acceptance criteria:

- From Richie: an Amazon Lightsail server `orderpilot-prod` in Singapore (Ubuntu 24.04 LTS, 4 GB memory, a static IP, and a firewall open on 22, 80 and 443); the path of its SSH key on his PC, and its domain (an `sslip.io` name made from the static IP); a GitHub environment `production`, limited to `main`, holding `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` and `DEPLOY_DOMAIN`.
- `infra/deploy/`: a server bootstrap run over SSH (Docker, the host firewall on 22, 80 and 443, fail2ban, swap, and automatic security updates).
- `infra/deploy/`: the app in `/opt/orderpilot`, with its own `.env` created there with generated secrets that are never printed. Richie adds the AI keys to it himself.
- `infra/deploy/`: Caddy for HTTPS, with the certificate for `DEPLOY_DOMAIN`; `docker-compose.prod.yml`, with no development ports; nightly PostgreSQL and MinIO backups, keeping seven days.
- `deploy.yml`, on each merge to `main`, after CI: builds the images and pushes them to GHCR, keeping only the latest five versions of each; SSHes to the server and pulls them, logging in to GHCR with the workflow's own short-lived token, so the server holds no GitHub credential; runs the migrations; checks health, and rolls back to the previous images on failure.
- `docs/deploy.md`: deploy, roll back, rotate secrets, read logs, restore a backup, and shut everything down after the module.
- The README gets the live demo link and a deployment table.
- A DAST job: an OWASP ZAP baseline scan of the live URL, weekly and on demand, with its report kept.
- ADR: the deployment.
- Decide where the live demo keeps documents: AWS S3 or a maintained S3 store instead of the source-built MinIO, which gets no upstream fixes. Only `S3_ENDPOINT`, the keys and the bucket change (ADR 0011).
- Trivy scans the images pushed to GHCR and uploads its reports to code scanning as SARIF, so findings show in the Security tab and not only in the job log (left out of P-13).
- Trivy also scans the images the stack pulls (PostgreSQL with pgvector, Redis and Mailpit), which P-13 does not: at the time, the Redis and pgvector images had fixable HIGH and CRITICAL findings. Move them to fixed versions, put accepted findings through `.trivyignore`, and pin them by digest (left out of P-13).

### P-25: Slides as code

A Marp deck for the Week 5 proposal, built and checked in CI.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `docs/slides`
- **Planned for:** Sprint 04 (W5)
- **Depends on:** P-16

Acceptance criteria:

- A Marp deck for the Week 5 proposal: 12 to 14 slides, one idea each, themed with the app's tokens, using real screenshots and diagrams, with speaker notes.
- `pnpm slides:build` exports PDF, HTML and PPTX.
- `slides:check` runs in CI.

### P-26: Generated API hooks and mocks

orval generates typed TanStack Query hooks and MSW mocks from the API's OpenAPI spec, so every area base starts from the same typed client.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-orval`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-8, P-11

Acceptance criteria:

- The API exports its OpenAPI spec to a file with no database running.
- orval, at an exact pinned version, generates typed TanStack Query hooks and MSW mocks from that file, through the web app's `ApiClient`.
- A CI step fails when the generated code is out of date.
- Every area base uses the generated hooks and mocks.
- An ADR (0019), a pinned version and a traceability row.

### P-27: Web shell polish

What P-11 and P-12 left out because no teammate needs it in its first week.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-web-polish`
- **Planned for:** Sprint 03 (W4)
- **Depends on:** P-11

Acceptance criteria:

- orval generates mutation hooks for POST, PUT, PATCH and DELETE, so screens stop wrapping the generated functions in `useMutation` (found by area 2, C-1).
- Unsaved form input also survives a page reload, through one small draft helper that forms can opt into. P-11 keeps it only across an ended session.
- A phone-width pass: screenshots at 390 px wide, light and dark, and the fixes they show. The sidebar already becomes a sheet, but spacing has not been reviewed on a phone.
- LCP and a Lighthouse run on the production build, with the figures recorded next to the screenshots.
- A collapsible sidebar that remembers its state, and a list of keyboard shortcuts.
- The refresh timer that runs a minute before the access token ends has a test with fake timers.
- Common components polish (P-12): keep the table's own query in the URL so a sorted, filtered page can be shared; keep the previous rows on screen while the next page loads; row selection with bulk actions; column order, resizing and density; a sticky header; money and number formatting with `Intl`; and export styling (number formats, column widths) once a client asks for it.
- Saved table filters on the server, so they follow a person to another device, plus a filter shared with a team. P-12 keeps them in the browser for one viewer.
- Retake docs/design/screenshots/platform/components-small-pieces-dark.png: it is clipped and its popover covers a neighbouring field.
- P-26 left out: generated hooks check each answer at run time with zod schemas generated from the OpenAPI file, and the error envelope is a documented response on every route, so a hook's error type is typed.

### P-28: Replace the accepted glob advisory with an override

Due between 2026-11-03 and 2026-11-05. GHSA-3g3m-2fjr-6pw4 is accepted in osv-scanner.toml until 2026-11-06, after which the OSV check fails on every pull request. The fix, glob 14.0.2, is inside the 7-day release-age window until 2026-11-03.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 1 points
- **Requirements:** M4 best practices
- **Branch:** `chore/glob-override`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-6

Acceptance criteria:

- From 2026-11-03, a pnpm override moves glob to 14 with its reason and a review date in pnpm-workspace.yaml, and `pnpm install` and `pnpm build` still pass.
- The GHSA-3g3m-2fjr-6pw4 entry is removed from osv-scanner.toml and from the table in docs/security/security-testing.md, and the OSV scan passes without it.
- Done and merged by 2026-11-05, a day before the accepted advisory expires.

### P-29: A unit coverage threshold on domain logic

Phase B. Prompt 001 section 11 asks for unit tests at 80 percent or more on domain logic. No threshold is enforced yet.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 2 points
- **Requirements:** M4 best practices
- **Branch:** `chore/domain-coverage-threshold`
- **Planned for:** Sprint 03 (W4)
- **Depends on:** P-6

Acceptance criteria:

- The domain folders are named in the test config (the API's domain services and rules, and the shared package's schemas and pure functions), so the threshold applies to logic and not to wiring.
- Vitest enforces 80 percent or more on lines, branches, functions and statements for those folders, and a run below it exits non-zero.
- The verify job runs the coverage check, and the coverage report is kept as a build artifact.
- docs/agile/test-plan.md names the folders and the threshold, and the practice is ticked in the build report.

### P-30: A k6 smoke load test

Phase B. Prompt 001 section 11 asks for a k6 smoke load test of the extraction queue and the order endpoints.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `test/k6-smoke`
- **Planned for:** Sprint 03 (W4)
- **Depends on:** P-18

Acceptance criteria:

- A k6 script in the repository sends a small, steady load at the order endpoints and enqueues documents on the extraction queue, using synthetic data only and the mock AI provider.
- Thresholds fail the run on a high error rate or a slow 95th percentile, with the numbers written down in docs/agile/test-plan.md.
- It runs against the Docker stack with one documented command, and its result is recorded in the build report.
- It is not a required check: it runs on demand or on a schedule, so a slow runner cannot block a merge.

### P-31: Data that looks real

Grow the synthetic data so every list looks like a working business. Prompt 003; finished before the handover on Monday evening, 2 Nov.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/product-pass-data`
- **Planned for:** Sprint 01 (W2) and Sprint 02 (W3)
- **Depends on:** P-9

Acceptance criteria:

- Grow `packages/synthetic-data` with the same fictional brands and the brief's countries: about 40 customers and 12 vendors.
- 300 items across IT, surveillance and accessories, each with a part number, brand, price, stock, quantity on sales order and quantity on purchase order.
- 120 orders spread across every state over the last 60 days, each with lines, amounts, documents, owners and dates.
- Payments, SPRs, tasks, reminders and exceptions to match.
- Every area's seed uses it, so the screens agree with each other.
- Keep the seed deterministic and under 30 seconds.
- Check: screenshots as every role it touches, at 1440 by 900 and 390 by 844 in `docs/design/screenshots/product-pass/`, looked at before merging: no "Planned", no tiles showing only a dash, no popups over content, no empty-looking lists, no text cut off.

### P-32: The consent card

One small consent card that never covers content. Prompt 003; finished before the handover on Monday evening, 2 Nov.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 2 points
- **Requirements:** M4 best practices, M6 deploy and monitor
- **Branch:** `feat/product-pass-consent`
- **Planned for:** Sprint 01 (W2) and Sprint 02 (W3)
- **Depends on:** F-1

Acceptance criteria:

- Make it one small card at the bottom right, shown once per browser and never over content.
- Remember the choice, and let Settings change it later.
- Change only its placement and frequency, not area 4's logic. Ask Angelyn to review.
- Check: screenshots as every role it touches, at 1440 by 900 and 390 by 844 in `docs/design/screenshots/product-pass/`, looked at before merging: no "Planned", no tiles showing only a dash, no popups over content, no empty-looking lists, no text cut off.

### P-33: Home pages that work

A home page for every role with real counts and the work waiting. Prompt 003; finished before the handover on Monday evening, 2 Nov.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `feat/product-pass-home`
- **Planned for:** Sprint 01 (W2) and Sprint 02 (W3)
- **Depends on:** P-31

Acceptance criteria:

- Tiles with real counts from the existing endpoints: my tasks, documents to confirm, open orders, open exceptions, overdue, awaiting approval, awaiting payment and ready to ship. Each tile opens the filtered list.
- Needs you: the role's top five items, with customer, amount and due date, and a one-click action on each.
- Quick actions for the role.
- The sales flow as a chain of steps with a live count at each step, and the purchase flow beside it marked phase 2. Clicking a step opens the tracker filtered to that step.
- For Management: the five KPIs with small trend charts (shadcn charts).
- Check: screenshots of the home page as every role, at 1440 by 900 and 390 by 844 in `docs/design/screenshots/product-pass/`, looked at before merging: no "Planned", no tiles showing only a dash, no popups over content, no empty-looking lists, no text cut off.

### P-34: Sign-in that sells it

A sign-in page that states OrderPilot's promise. Prompt 003; finished before the handover on Monday evening, 2 Nov.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-sign-in`
- **Planned for:** Sprint 01 (W2) and Sprint 02 (W3)
- **Depends on:** P-12

Acceptance criteria:

- A split layout: the form on one side, and OrderPilot's promise on the other.
- That side has the tagline, the three-step "AI reads, rules decide, people approve" and a subtle animated order flow (React Bits free or Magic UI free).
- Demo sign-in stays one click per role.
- Check: screenshots at 1440 by 900 and 390 by 844 in `docs/design/screenshots/product-pass/`, looked at before merging: no "Planned", no tiles showing only a dash, no popups over content, no empty-looking lists, no text cut off.
- Polish left for later: the sign-in page remembers the role a visitor picked last, and the order flow gets a short still picture on a phone.

### P-35: Master data

Lists and detail pages for customers, vendors and items, brought forward from P-19. Prompt 003; finished before the handover on Monday evening, 2 Nov.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/product-pass-master-data`
- **Planned for:** Sprint 01 (W2) and Sprint 02 (W3)
- **Depends on:** P-31

Acceptance criteria:

- Lists and detail pages for customers, vendors and items, read from the mock Business Central data and labelled "Mock Business Central".
- An item shows stock, quantity on sales order, quantity on purchase order, available stock, price, brand and vendor.
- A customer shows country, currency, payment terms, price group, open orders and overdue items.
- A vendor shows its bank accounts (masked by role) and its open purchase orders.
- Check: screenshots as every role it touches, at 1440 by 900 and 390 by 844 in `docs/design/screenshots/product-pass/`, looked at before merging: no "Planned", no tiles showing only a dash, no popups over content, no empty-looking lists, no text cut off.

### P-36: Orders: the reader and the list

Orders as real records, with the sample set behind one reader, and the orders list on prompt 004's template. Prompt 003 item 6.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/product-pass-orders`
- **Planned for:** Sprint 01 (W2) and Sprint 02 (W3)
- **Depends on:** P-31, P-35, P-45

Acceptance criteria:

- An ADR records it: the 120 sample orders stay in the synthetic set, because their dates move with today, and new orders are real rows in OrderPilot's own tables.
- `apps/api/src/modules/orders`, in layers, with `SalesOrder` and `SalesOrderLine`, a capture state of draft, submitted or void that is never called status, and new numbers from the record number service.
- `OrderDirectory` answers for sample and stored orders alike, and whatever needs an order's facts asks it, so a new order shows up wherever a sample order does.
- `GET /orders` and `GET /orders/:orderNo` are paged, sorted and filtered on the server, masked by role, with `.http` requests and API tests for 401, 403, 404 and validation.
- Orders is a list on the template in the Sales module, and leaves the planned list.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.
- Orders waiting on stock are one filter away, and a short line says by how much, so a person resolves each shortage; nothing is ordered for them.

### P-37: Document intake and the inbox

A safe upload and a documents inbox on prompt 004's template, brought forward from P-18. Prompt 003 item 7.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/product-pass-documents`
- **Planned for:** Sprint 01 (W2) and Sprint 02 (W3)
- **Depends on:** P-31, P-45, P-14

Acceptance criteria:

- `POST /documents` takes PDF, PNG, JPEG, XLSX and CSV only, sniffed and not trusted, with size limits and a zip-bomb guard. Nothing executable is accepted.
- Files go through the storage service, a `Document` row records them, `GET /documents/:id/file` streams them behind `documents.read`, and the same content uploaded twice links to the first.
- `DocumentDirectory` answers for sample and stored documents alike.
- Inbox is a list on the template in the Documents module, with Upload PO as its one primary action, on the page and not in a popup, and in the home page and Ctrl+K for the roles allowed.
- A document can be voided with a reason, with its own permission, and every step is audited.
- `.http` requests and API tests for every kind of refused upload.
- A Playwright test: an allowed role uploads and voids a document, and a role without the permission sees no button and gets a 403 from the server.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.
- Files saved out of WhatsApp upload like any other, product managers may upload vendor invoices with the permission Angelyn's issue asks for, and the inbox shows where each document came from.

### P-38: The task inbox on the templates

UI only: the first of the teammates' screens to move. Prompt 004 section 7, and prompt 003 item 8.

- **Area:** `area: 2 order workflows and approvals`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `feat/template-inbox`
- **Planned for:** Sprint 01 (W2) and Sprint 02 (W3)
- **Depends on:** P-45

Acceptance criteria:

- The task inbox is a compact list on the template, with its filters in the address, and reminders as a tab.
- Inline actions use the mock overlay. Batch actions cover only tasks that merely complete, never an approval or a payment, and end with one toast and one Undo.
- The core logic stays `it.todo`, and Azri reviews the pull request.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-39: Module navigation, showing only what is real

Navigation by business module, with counts, and no placeholder a reviewer can reach. Prompt 004 section 2, and prompt 003 item 9.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 2 points
- **Requirements:** M4 best practices
- **Branch:** `feat/workspace-modules`
- **Planned for:** Sprint 01 (W2) and Sprint 02 (W3)
- **Depends on:** P-12, P-33, P-35

Acceptance criteria:

- Navigation is by module, in prompt 004's order: Home, Sales, Purchasing, Warehouse, Finance, Documents, Master data, Reports and System. A feature declares its menu entries, each naming its module and permission.
- Each role sees only its own modules, a module with nothing to show is left out, and existing addresses keep working.
- The task inbox stays reachable as My tasks under Home until My work replaces it.
- A menu entry that holds waiting work shows its count, from the hook the home tiles use, so a tile and a menu count always agree. A role that may not read a list makes no request for it.
- A feature declares whether it is ready. In a production build a planned feature is left out of the menu, the routes, Ctrl+K, the home page and the breadcrumbs, and its address shows not-found.
- Phase 2 pages are not declared at all.
- `PlannedPage` stays behind an opt-in development flag, off by default, and its text is not in the production bundle.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-40: The bar for every screen: dense tables, keys and actions

The efficiency and density rules every list and detail page meets. Prompt 003; finished before the handover on Monday evening, 2 Nov.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-the-bar`
- **Planned for:** Sprint 01 (W2) and Sprint 02 (W3)
- **Depends on:** P-12

Acceptance criteria:

- Compact table rows (36 to 40 px), with numbers right-aligned in tabular figures and amounts with their currency.
- Skeletons that match the final layout, and no large empty cards.
- Ctrl+K runs actions as well as navigation.
- "/" focuses search, and "N" starts a new record on lists that have one.
- Every action ends with a toast, with Undo where it can be undone.
- Check: screenshots as every role it touches, at 1440 by 900 and 390 by 844 in `docs/design/screenshots/product-pass/`, looked at before merging: no "Planned", no tiles showing only a dash, no popups over content, no empty-looking lists, no text cut off.

### P-41: Finish the bar on every list and detail page

What P-40 left out so the product pass could close: the pieces every screen inherits but each page still has to adopt.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Planned for:** Sprint 03 (W4)
- **Depends on:** P-40

Acceptance criteria:

- Every list that has a primary action declares it through `PageHeader`, and its title shows the total.
- The role matrix and the other plain tables keep their first column in view on a phone, as the common table does.
- A setting to turn the `/` and `N` keys off for people who use a screen reader or their own keys.
- Plain tables built on `ui/table` meet the 36 to 40 px row height too (the Users table is compact now; the others are not measured).
- Copy role can be undone, once the API keeps a snapshot of the target role's rows.
- The home-tile part of the Check in P-40 (no tile showing only a dash, no "Planned" badge) is met by P-33, not by P-40.
- The quick actions move into the stories that bring them: Upload PO in P-37, New order in P-49 and Raise SPR in P-61.

### P-42: Plan prompt 004

Files prompt 004 and turns it into stories, in the order of its section 9.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 2 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `chore/plan-prompt-004`
- **Planned for:** Sprint 02 (W3)

Acceptance criteria:

- Prompt 004 is in `docs/ai/prompts/`, and every reference to the prompt that writes each area's stories names prompt 005.
- The backlog holds prompt 004's stories, and P-18, P-36 to P-39 and P-41 are rescoped so that nothing is built twice.
- `docs/team/module-ownership.md` records the exception that prompt 004 section 7 makes for moving the teammates' screens onto the templates.
- `docs/BUILD_REPORT.md` shows the status of each story, and the Waiting for Richie list holds the decisions taken while cutting the stories.

### P-43: Records open as tabs

A strip of open records under the top bar, like an ERP workspace. Prompt 004 section 2.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `feat/workspace-record-tabs`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-39

Acceptance criteria:

- Opening an order, document or SPR adds a tab to a strip under the top bar, showing the record's kind and number. A record route declares itself in one line.
- Tabs belong to one person: they survive a reload, and a role switch shows that role's tabs.
- Ctrl+click or Command+click opens a record in a background tab, from every list and link, through one `RecordLink`.
- Each tab has a close button, and there are at most ten. An eleventh closes the oldest tab with no unsaved changes, and says so.
- Breadcrumbs stay, and gain the record's number.
- The strip works from the keyboard, and at 390 px it scrolls inside itself.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-44: List template: filter bar, action bar and status chip

The first half of the list page template, proved on the master data lists. Prompt 004 section 3.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Branch:** `feat/list-template-bars`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-33, P-35

Acceptance criteria:

- One URL query hook replaces the two that P-33 and P-35 brought, keeping search, filters, page and sort in the address. `DataTable` stays under 200 lines.
- The shadcn/ui primitives the templates need are added: checkbox, select, textarea and form.
- `StatusChip` gives each of prompt 004's five families one colour and one icon: draft, waiting, ready, blocked and done. A status with no family shows neutral.
- Filter bar: a quick search, the three or four filters that matter, More filters for the rest, and chips for what is applied.
- Action bar: New, Edit, Void or Disable, batch actions, Import, Export and Print. Each shows only if the screen declares it and the role holds its permission, so a screen never offers a button the role cannot use.
- Void and Disable ask for a reason in one shared dialog, and the reason is required.
- Export gives every filtered row, masked as the screen is, and Print gives a clean print view.
- `ListPage` builds a page from one declaration, and the Items, Customers and Vendors lists move onto it.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-45: List template: grid, saved views and operation log

The second half of the list page template. Prompt 004 section 3.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/list-template-grid`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-44

Acceptance criteria:

- Row checkboxes, select all on the page, a count of what is selected, and batch actions in the action bar.
- A row menu with View, Edit, Copy and Void where the screen declares them, built so that My work can add its three actions in one place.
- Saved views hold filters, sort and columns for each person. Column settings show, hide and order columns.
- The selected record's operation log sits in a panel at the foot.
- A record-scoped read of the log: anyone who may read the record sees who, when and what, never field values or an IP address. Refusals are audited, and area 4 reviews the rule.
- Print keeps the title on every page, numbers the pages and prints a long list in a stream, so a list of many thousands of rows does not sit in the page at once (P-44 prints every row in one table).
- The tracker, the exceptions queue, the users list and the inbox move onto `ListPage`, one line or redirect each in their owners' folders, each owner asked to review (P-44 changes only their URL hook import).
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-46: Form kit

Fields, server errors and drafts for every form. Prompt 004 section 3.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/form-kit`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-44

Acceptance criteria:

- `FormField`, on React Hook Form with zod: label, hint, error and required mark, for text, number, money, date, select, long text and lookup fields.
- Validation is inline, field by field. A server's `VALIDATION_FAILED` details land on their fields in the server's words, and any other error shows its trace id.
- Unsaved changes survive an expired session and a reload, for each person and record, and never hold a masked field. A restored draft says so and can be thrown away.
- Leaving a form with unsaved changes asks first.
- Component tests cover every state.

### P-47: Document form

The form every order, SPR, payment and shipment uses. Prompt 004 section 3.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Branch:** `feat/document-form`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-45, P-46

Acceptance criteria:

- A header grid of fields, a footer with totals, attachments and the status chip, and an action bar: Save, Save and new, Submit for approval, Approve or Reject when the role may, Print or PDF, and Void.
- Each action shows only if the form declares it and the role may use it.
- Below the form, tabs for Timeline, Checks, Documents and Operation log, each with a count of what needs attention and a compact empty state.
- Print or PDF uses the browser's print view until B-3 brings generated documents.
- Component tests cover every state, and the demo gallery shows the template.

### P-48: Lines grid

Inline order lines with item lookup and availability. Prompt 004 section 3.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Branch:** `feat/lines-grid`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-46

Acceptance criteria:

- Inline editing of lines: item lookup by part number or name, quantity, unit price, amount and availability.
- Enter adds a line, Delete removes one, and the grid works from the keyboard alone.
- Amounts and totals are computed from decimal strings, never floats, and update as you type.
- A server error on `lines.N.quantity` lands on that cell.
- A shortfall is flagged on the line with what is needed, what is available and how short it is. It never stops saving.
- A masked price stays masked, with its reason, and the grid has a read-only mode.
- At 390 px each line stacks, with no sideways page scroll.
- Component tests cover the keyboard path, and the demo gallery shows the grid.

### P-49: New order and draft editing

Support enters an order on the document form. Prompt 004 section 4.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/order-form`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-36, P-47, P-48, P-14

Acceptance criteria:

- `/orders/new` and the draft's own page use the document form and the lines grid, with the customer chosen by search and matched on its Business Central number.
- `POST /orders` and `PATCH /orders/:orderNo`, for drafts only, with new permissions held by Support and the Product Manager and never by System admin.
- No duplicate orders: one customer plus one PO number is one order, with a unique index and a 409 that names the existing order, and the form links to it.
- Availability shows live on each line, from the same formula as master data.
- New order is the list's one primary action, N starts it, and the home page and Ctrl+K offer it to the roles allowed.
- Every route has `.http` requests and API tests for 401, 403, 404, validation and the duplicate.
- A Playwright test: an allowed role creates, edits and voids a record, and a role without the permission sees no button and gets a 403 from the server.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-50: Submit, cancel and copy an order

The rest of an order's life on area 1's side. Prompt 004 section 4.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/order-actions`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-49

Acceptance criteria:

- Submit moves the order's capture state and calls an `OrderHandoff` port, bound to a mock. Azri binds it after C-2, and no transition rule is written here.
- A submitted order then appears in the tracker and the home page's flow, from a fixture state named as a fixture.
- Cancel asks for a reason, works on a draft or a submitted order, sample orders included, and hard-deletes nothing.
- Copy opens a new draft from any order.
- Every action is audited, and the Playwright test from P-49 covers them.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-51: The one order page

One page for an order, with each area's section in its owner's folder. Prompt 003 item 6, on prompt 004's document form.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M3 AI-assisted coding, M4 best practices
- **Branch:** `feat/one-order-page`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-50

Acceptance criteria:

- `/orders/:orderNo` is the single place for an order, and `/order-tracker/:orderNo` and `/workflows/orders/:orderNo` redirect to it.
- Area 2's steps and area 3's checks stay components in their owners' folders, moved and not rewritten, and show in the Timeline and Checks tabs.
- The Documents and Operation log tabs show what is real, and an order with little to show says so compactly.
- Next actions for the signed-in role sit in the action bar, using the same actions as Needs you. A role with nothing to do sees what is waiting, and on whom.
- Azri and Iok Teck are asked to review.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-52: Demo documents

Real PDFs and ground truth for the review screen, from `packages/synthetic-documents`. Brought forward from P-21.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/demo-documents`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-37

Acceptance criteria:

- `packages/synthetic-documents` renders a document from the synthetic set to a real PDF: pure, deterministic, and returning each field's value and its place on the page.
- Four layouts, so POs from different customers look different, all labelled "Synthetic demo data" with obviously fake bank details.
- 12 files in `apps/web/public/demo-documents/`, with the script that makes them: POs, PIs, packing lists, one scanned-looking PO, and a packing list whose quantity differs from the PO.
- Each is tied to a real order, and an order with three uncertain fields has exactly three, on any reference date, with a test.
- The PDF library has an ADR, a pinned version and a traceability row.

### P-53: Mock AI and the review fields

Mock AI reads a document, and a person confirms the uncertain fields. Prompt 003 item 7.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/document-review`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-52

Acceptance criteria:

- Mock AI classifies a known document and fills its fields from the ground truth, labelled "Mock AI". An unknown file ends honestly, and it never invents a field.
- `/documents/:id` shows the fields, grouped into header and lines, each with its confidence and source, and "Requires approval" on the uncertain ones.
- Confirm and Correct are inline and keyboard first. A review stores who, when, the old value and the new one in OrderPilot's own tables, and each is audited, with Undo.
- When every uncertain field is done the document is confirmed and its task leaves the inbox. No order status changes and nothing goes to Business Central.
- To review is a list on the template, and the home page's tile opens it with the same count.
- Bank details never reach a role that may not see them, tested on the bytes of the response.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-54: Document preview and highlight

The page beside the fields, and where each field came from. Prompt 003 item 7.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Branch:** `feat/document-preview`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-53

Acceptance criteria:

- PDFs preview through pdfjs-dist in a lazy chunk with its worker bundled, so the strict CSP holds. Images show directly, and XLSX or CSV as a simple table.
- Selecting a field scrolls the page to it and highlights where it came from, scaled with the zoom, in both themes.
- Zoom, and pages when there are several, from the keyboard too.
- At 390 px the preview and the fields stack, with a way to jump between them.
- pdfjs-dist has an ADR, a pinned version and a traceability row, and `pnpm budget` passes.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-55: An order from a confirmed PO

Enter once, flows everywhere. Prompt 004 section 4.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/order-from-po`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-49, P-53

Acceptance criteria:

- A confirmed PO offers Create order, which opens a draft pre-filled from what a person confirmed.
- Customers and items match on their Business Central numbers, a look-alike name is only shown as a possible match, and a new customer goes through P-88's check.
- The draft keeps a link to its source document, and the two pages link to each other.
- The order form's footer lists its attachments, and Attach uploads through P-37's route.
- The Playwright test covers the path from upload to a saved draft.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.
- Create order is offered only once a person has confirmed every field the reader was unsure of and looked at every mismatch, and the order records who confirmed them.

### P-56: Pins, to-dos and reminders: the records

Each person's own records, audited. Prompt 004 section 5.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/my-work-records`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-15, P-45

Acceptance criteria:

- Pins, to-dos and reminders are stored for one person, on any record or as free text. Nobody else can read or change them, and a test proves it.
- Routes to create, edit, reorder, finish and remove them, voided with a reason where a business record would be, and never hard-deleted.
- Every change is audited, and these stay separate from area 2's tasks and reminder engine.
- `.http` requests and API tests for 401, 403, 404 and validation.

### P-57: Pin to top, Remind me and Add to my to-dos

Three actions on every row menu and record page. Prompt 004 section 5.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `feat/my-work-actions`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-56

Acceptance criteria:

- Every row menu, record page and read-only master data page offers the three actions, added in one place.
- Pinned records float to the top of their own list, for that person only, and the list endpoints of other areas stay unchanged.
- Each action ends with a toast and Undo.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-58: The My work panel

Four tabs on the home page. Prompt 004 section 5.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `feat/my-work-panel`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-57

Acceptance criteria:

- The home page has a My work panel with four tabs: Needs you, My to-dos, Reminders and Pinned.
- Needs you shows what the home page shows today. My to-dos has a due date, a done checkbox and drag to reorder, with buttons for the keyboard.
- Reminders also lists area 2's system reminders, marked System, read from its route.
- Pinned records show first on the home page.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-59: Personal reminders fire

Reminders on the platform's BullMQ queue, with mail to Mailpit. Prompt 004 section 5.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices, M6 deploy and monitor
- **Branch:** `feat/my-work-reminders`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-58

Acceptance criteria:

- A reminder fires on a date, or when a condition from a closed list holds, such as still unpaid on a date.
- Postgres holds each reminder. A delayed BullMQ job fires it, and a repeating sweep requeues what is due, so losing Redis loses nothing and nothing fires twice.
- When it fires, the bell and the home page show it for any role, and an email goes to Mailpit if the person chose one.
- A mail sender that can only reach Mailpit, with an ADR, a pinned version and `.env.example` entries, unless P-87 merged first and brought it.
- The worker runs in the compose stack and in the end-to-end job, and a Playwright test sees a reminder fire.

### P-60: SPR drafts and the SPR list

OrderPilot's own SPR drafts, beside area 2's approval. Prompt 004 section 4.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/spr-drafts`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-45, P-46

Acceptance criteria:

- An area 1 table holds drafts, numbered by the record number service, with no limit, trigger or status logic. The port that hands a submitted draft to area 2 is agreed with Azri.
- SPRs is a list on the template, in the Purchasing module, reading sample and stored SPRs through one reader, with the approver's waiting count on its menu entry.
- The product manager raises an SPR, because the product manager is also the purchase manager (prompt 005 section 1), with the permission recorded.
- `.http` requests and API tests for 401, 403, 404 and validation.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-61: The SPR form

Raise an SPR from stock on hand and the three-month run rate, pre-filled. Prompt 005 section 1.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/spr-form`
- **Planned for:** Sprint 08 (W9) and Sprint 09 (W10)
- **Depends on:** P-60, P-47, P-48, P-86

Acceptance criteria:

- An SPR is raised from an item on the document form, pre-filled through `SprSuggestion` with the stock on hand, the last three months' run rate and the months of cover, from P-86's figures and the basis Azri's issue asks for.
- It can be edited while it is a draft, submitted, and withdrawn with a reason.
- A submitted SPR reaches the coordinator through the agreed port, the coordinator routes it to the approver group (P-100), and the AI never raises or approves one.
- Raise SPR appears on the item page, and in the home page and Ctrl+K for the product manager.
- Azri is asked to review.
- A Playwright test: an allowed role creates, edits and voids a record, and a role without the permission sees no button and gets a 403 from the server.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.
- The pre-filled SPR stays a draft until a person reviews it and submits it, it shows which fields were suggested and from what, and it warns, with a link, when an open SPR already covers the item.
- After approval the coordinator hands the SPR back, and the product manager records the vendor PO or the vendor portal's reference (P-101).

### P-62: Payment confirmations

Finance records and voids payments. Prompt 004 section 4.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/payment-entries`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-47

Acceptance criteria:

- An area 1 entry holds a payment while it is a draft, so that Finance can record it and edit it before confirming. Azri's `PaymentConfirmation` is untouched.
- Confirm calls area 2's existing route, and the payment gate's effect stays area 2's.
- Void asks for a reason, and still records it when the mock overlay has forgotten the payment.
- Payments is a list on the template in the Finance module, with a document form, and amounts and bank details masked by role.
- Azri is asked to review.
- A Playwright test: an allowed role creates, edits and voids a record, and a role without the permission sees no button and gets a 403 from the server.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.
- Only Finance records, confirms or voids a payment, and the entry keeps the amount received, the bank charges and the payer's reference, so a transfer that arrives a little short can be matched later by area 2 and area 3.

### P-63: Shipments

Logistics records forwarders and AWB/BL numbers for outbound shipments; inbound ones are P-102. Prompt 004 section 4.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/shipments`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-47

Acceptance criteria:

- A new area 1 module holds a shipment: the order, the forwarder, the AWB or BL number and the dates, with no status logic.
- Shipments is a list on the template in the Sales module, with a document form, reading sample shipments from the synthetic set and stored ones through one reader.
- Logistics records, edits and voids a shipment with a reason.
- Area 2's follow-ups can read a shipment, with Azri's yes.
- A Playwright test: an allowed role creates, edits and voids a record, and a role without the permission sees no button and gets a 403 from the server.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.
- The shipment also holds the shipping terms, and which shipping papers have arrived (the AWB or BL and the import permit) as fields a person ticks; reminders about the missing ones stay area 2's.

### P-64: Users

A list and a form for Spectra's staff. Prompt 004 section 4.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/system-users`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-45, P-46

Acceptance criteria:

- `/system/users` is a list on the template, and the old governance link redirects to it.
- A form with name, email, role, data scope and status: create, edit, disable, re-enable, and reset the demo password.
- Disable asks for a reason, every change is audited, and a person cannot disable themselves.
- Data scope is per role today, so the form shows it read-only and says so.
- Angelyn is asked to review.
- A Playwright test: an allowed role creates, edits and voids a record, and a role without the permission sees no button and gets a 403 from the server.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-65: Roles

Permissions grouped by module, in plain names. Prompt 004 section 4.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/system-roles`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-64

Acceptance criteria:

- A list of roles, and a page for each with its permissions grouped by module as checkboxes, Select all in module, its data scope and Copy role.
- The role set stays the nine roles of the brief, so Copy role copies onto an existing role. The enum stays, and the pull request says so.
- The full grid stays only as a read-only Compare roles view, and the old links redirect.
- Plain names everywhere, never raw keys like `permissions.tracker.read`.
- It calls the existing matrix routes, and a locked cell stays locked and says why. The policy itself is untouched.
- Angelyn is asked to review.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-66: Approval limits form

A form only, in the shape of Business Central's Approval User Setup. Prompt 004 section 4.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/settings-approval-limits`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** F-3, P-46

Acceptance criteria:

- A list and a form for each approver's limits, parsed by `approvalUserSetupSchema`, on the route F-3 brings.
- `ApprovalPolicy` and the verdict stay with their owners, and the form changes no logic.
- Angelyn is asked to review.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.
- It shows the approver group of three, any one of whom decides, with limits switchable and none set and no substitute column, in the shape Angelyn settles in her issue.

### P-67: Check tolerance and reminder rule forms

Forms only, for areas 2 and 3. Prompt 004 section 4.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/settings-rule-forms`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-46

Acceptance criteria:

- A keyed, audited setting table behind `settings.manage`, with each value parsed by a schema its owner approves.
- A form for area 3's check tolerances and one for area 2's reminder rules, in the System module under Rules.
- Nothing reads them until D-2 and C-4 do, and each form says so in plain words.
- Iok Teck and Azri are asked to accept the shape before this merges.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.
- The check tolerance form has no field for part number, quantity, unit price or currency.

### P-68: Change requests for master data

Managed in Business Central, with Request a change. Prompt 004 section 1.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/master-change-requests`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-44, P-46

Acceptance criteria:

- Customers, vendors and items say Managed in Business Central, and offer Request a change.
- A request is a record, and a second person approves it before it is applied, to mock data only.
- A change to a vendor's bank details stops at a port for area 4's control and is never applied here.
- Every step is audited, and a person cannot approve their own request.
- A Playwright test: an allowed role creates, edits and voids a record, and a role without the permission sees no button and gets a 403 from the server.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-69: Mock Business Central Demo data page

Test records for demos, for System admin only. Prompt 004 section 1.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `feat/mock-business-central-demo-data`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-68

Acceptance criteria:

- A page for System admin only, with its own permission, labelled as demo only, to add and edit test records in mock Business Central.
- It works only with demo mode on, and the server refuses it otherwise.
- P-20's real connector retires it.
- A Playwright test: an allowed role creates, edits and voids a record, and a role without the permission sees no button and gets a 403 from the server.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-70: Pick and pack, and Proforma invoices

The two module pages that have no form of their own yet. Prompt 004 section 2.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `feat/work-queues`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-45

Acceptance criteria:

- Pick and pack in the Warehouse module and Proforma invoices in the Sales module are lists on the template, of the work waiting for that role.
- Each row opens the order and offers the action Needs you offers. Nothing is generated: B-3 brings documents.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.
- The pick list works on a tablet, with touch targets of 44 px or more.

### P-71: One status system everywhere

Status chips, timers and counts. Prompt 004 section 6.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `feat/status-families`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-44

Acceptance criteria:

- Area 2 reports an optional family beside each status, so ADR 0025's rule that status codes stay unlisted holds. Each owner is asked to review.
- The same chip is used on every screen.
- Overdue and SLA timers, such as "due in 3 h" and "2 days late", show only what the API reports.
- The sidebar and the tabs show counts of what needs attention.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-72: SPR approval on the templates

UI only. Prompt 004 section 7.

- **Area:** `area: 2 order workflows and approvals`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `feat/template-spr-approval`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-47

Acceptance criteria:

- SPR approval uses the document form, showing the request, the stock picture, the order and the limit as a fact. It computes and enforces nothing.
- The core logic stays `it.todo`, and Azri reviews the pull request.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.
- It also shows the cost against the selling price where the role may see both, the vendor and the lead time, because the approver decides with them.
- It shows the approver group, any one of whom decides, with Approve or Reply with remarks and the reminder countdown, at 390 by 844 as well.

### P-73: Exceptions on the templates

UI only. Prompt 004 section 7.

- **Area:** `area: 3 checks tracker and insights`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `feat/template-exceptions`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-45

Acceptance criteria:

- Exceptions is a list on the template, every column fits at 1440, and an exception shows expected and found side by side.
- Assign and resolve stay hidden until D-3 brings them, and the checks engine stays Iok Teck's.
- Iok Teck reviews the pull request.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.
- Each difference says whether it blocks or warns, beside expected and found.

### P-74: Tracker and KPIs on the templates

UI only. Prompt 004 section 7.

- **Area:** `area: 3 checks tracker and insights`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `feat/template-tracker-insights`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-45

Acceptance criteria:

- The order tracker is a list on the template, and each row opens the one order page.
- KPIs show each measure's value, target and trend, reusing the lazy chart component. A miss is said in words as well as colour, and no formula is computed.
- Iok Teck reviews the pull request.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.
- Every chart has a data-table view for screen readers (prompt 006 section 4).

### P-75: Audit log on the template

UI only. Prompt 004 section 7.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `feat/template-audit`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-45

Acceptance criteria:

- The audit log is a list on the template, with rows of 36 to 40 px.
- Angelyn reviews the pull request.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-76: Governance and monitoring on the templates

UI only. Prompt 004 section 7.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `feat/template-monitoring`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-65

Acceptance criteria:

- Masking, AI destinations and the monitoring tabs use the templates, with the first column kept in view on a phone.
- Audit and policy logic stay `it.todo`, and Angelyn reviews the pull request.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-77: Tab strip polish

Left out of P-43 because no teammate needs it this week.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `feat/workspace-tab-polish`
- **Planned for:** Sprint 03 (W4)
- **Depends on:** P-43

Acceptance criteria:

- A tab's context menu offers Close others and Close all, and a tab can be dragged to a new place in the strip.
- A second browser window shows the same tabs without a reload.
- A tab for a record that no longer exists, or that the person may no longer open, says so on the strip.

### P-79: End-to-end follow-ups

Follow-ups to P-14 that nobody needs this week: a clean-machine proof of the set-up and a wider browser check.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 3 points
- **Requirements:** M4 best practices, M6 deploy and monitor
- **Branch:** `test/e2e-follow-ups`
- **Planned for:** Sprint 03 (W4)
- **Depends on:** P-14

Acceptance criteria:

- A CI job runs `pnpm local:setup` on a clean runner and then the smoke test against `pnpm dev`, so Getting started is proven on every change to it (left out of issue 102).
- Someone runs Getting started on macOS once and fixes what differs, and the page stops saying macOS is untested (left out of issue 102).
- The smoke test runs each page in the dark theme too, so axe checks the contrast of both themes.
- `apps/web/scripts/screenshots.mjs` and the walk take Playwright from `apps/e2e` instead of an install outside the repository.
- Firefox and WebKit projects, if a story or the panel needs them.

### P-78: Room in the entry bundle

The initial JS was at 248.8 KB of its 250 KB budget, so the next prompt 004 stories had no room. Make room under the same limit, with no change anyone can see.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M4 best practices, M6 deploy and monitor
- **Branch:** `perf/entry-bundle-room`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-11

Acceptance criteria:

- Measure what the initial chunk holds, by module and by package, and put the top 20 in the pull request, before and after.
- Move out what the first screen does not need: the barrel, click-only dialogs and menus, the generated client and lazy locale namespaces, each checked rather than assumed.
- Every lazy piece shows the right skeleton or nothing while it loads, prefetches on idle where a click would wait, and changes nothing a person sees or can do.
- The initial chunk is at 225 KB gzip or less.
- `pnpm budget` prints the initial size and the five largest modules in it, and the limit is not raised.
- The walk for all nine roles ends with 0 FAIL in light and dark, and looks the same as on main.
- A Playwright script signs in from a cold load as three roles and opens the role switcher, the user menu, the bell and Control K, and lets a session end, with no console error and no CSP violation.
- The rule for what the shell may import is written in `docs/architecture/patterns.md`.

### P-80: Lines grid polish

Left out of P-48 because no teammate needs it this week.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `feat/lines-grid-polish`
- **Planned for:** Sprint 03 (W4)
- **Depends on:** P-48

Acceptance criteria:

- Pasting rows from a spreadsheet (a part number and a quantity on each) fills one line per row, each part number resolved on its Business Central number, and the rows that match nothing are listed for the person to fix.
- The shortfall counts every line that asks for the same item together, not each line alone, and says which lines add up to it.
- A click on a line's number selects the line, so the mouse can reach Delete too.
- Column widths can be dragged and are kept for each person.
- A line can be moved up or down with the keyboard, and the move can be undone.

### P-81: Settle into the private repository

Richie made the repository private on 5 Nov. Rule 8 of CLAUDE.md lists what follows, and two build report items come with it: the first verify run on the smaller private runners (item bk) and Dependabot moving to monthly (item bp).

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 2 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `ci/private-repository`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-6

Acceptance criteria:

- The `Protect main` ruleset is still active, `check-ruleset.mjs` finds no drift from `.github/rulesets/main.json`, and the wiki still opens.
- `SECURITY.md` says how to report a problem now that private vulnerability reporting is gone, and lists only what still runs. `docs/security/security-testing.md` says what changed.
- Dependabot version updates run monthly in all four ecosystems, with the 7-day cooldown kept, and the docs that said weekly say monthly.
- The first verify run on the private runners is read, and any check that fails there for want of time, memory or disk is fixed, with the reason beside the fix.
- What says the repository is public is corrected: `CLAUDE.md`, `CONTRIBUTING.md`, the pull request template and the GRS risks. An ADR records what going private changed.
- A-31 records Richie's decision of 5 Nov: Spectra's briefing material stays outside the repository and our coding tools may read it on his PC, while real business samples still wait for Spectra's written OK (Q-12).

### P-82: Plan prompts 005 and 006

Files prompts 005 and 006 and turns them into stories, in the order of 005 section 12 and 006 section 7.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 2 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `chore/plan-prompts-005-006`
- **Planned for:** Sprint 03 (W4)

Acceptance criteria:

- Prompts 005 and 006 are in `docs/ai/prompts/` as Richie approved them, and T-9, `render.mjs`, the rendered backlog and the wiki name prompt 007 as the handover prompt.
- The backlog holds P-82 to P-112, each under the epic of its capability, and the stories the briefing changes are updated so that nothing is built twice.
- `docs/team/module-ownership.md` records the exception prompt 005 sections 5 to 7 make: Richie builds the platform side of the briefing's changes, never the owners' rules.
- `backlog.test.mjs` and `seed-backlog.test.mjs` carry the new counts, a renamed-stories map keeps the prompt 001 checks, a test holds every epic at 95 stories or fewer against GitHub's limit of 100 sub-issues, and `node --test` over `scripts/github` and `render-docs.mjs --check` pass.
- `docs/BUILD_REPORT.md` has a section for prompts 005 and 006 with the story table, the Waiting for Richie list holds the decisions taken while cutting, and area 1's table in `docs/ai/ai-usage-log.md` has one row.

### P-83: Rename Navision to Business Central

Spectra moved to Business Central, so pages, docs and area 1's code names say so, while stored names stay.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `chore/business-central-rename`
- **Planned for:** Sprint 03 (W4)
- **Depends on:** P-82

Acceptance criteria:

- Every page says Business Central, Managed in Business Central or Mock Business Central where it said Navision: locale values change and their keys stay, and the tests that assert those words follow, including the negative assertion in `DraftOrderPage.test.tsx`.
- `CLAUDE.md`, `README.md`, `CONTRIBUTING.md` and the `docs/` pages say Business Central, naming Microsoft Dynamics 365 Business Central once on each page. Prompts 001 to 006, the AI usage log, merged ADRs and the build report outside its Waiting list stay as written.
- `docs/team/area-2-*.md`, `area-3-*.md` and `area-4-*.md` stay out of this sweep: their lines are listed in each owner's issue, and the owners change them.
- `docs/grs/grs-by-design.md` rewords risk R-06 for the ERP Spectra now runs instead of swapping the word, and `docs/data-formats.md` and `docs/research/domain-notes.md` say that API v2.0 renames these fields and the connector maps them.
- Area 1's code names change where the rename stays inside area 1: `MockNavisionMasterData` and its file, the `mockNavision` badge kind, and the Swagger summaries and messages in area 1's API.
- The comments and titles that only describe the mock follow: `packages/shared` (23 comment lines in 9 files, with all four owners asked to review), `packages/synthetic-data` (7 lines), `apps/api/requests/master-data.http` and `orders.http`, the API test titles in `master-data.parity.test.ts`, `test/http/master-data.test.ts` and `test/database/sales-order.test.ts`, area 1's API comments, and 11 comments in the web code.
- Database columns, wire properties, the stored `navision` value, i18n keys, other areas' identifiers and the shared exports (`navisionNoSchema`, `NavisionStatus`, `NAVISION_STATUSES` and `navisionStatusSchema`, of which area 2 imports `NavisionStatus`) keep their names, and an ADR says why.
- The words this story changes in the owners' files (`workflows.json`, `order-tracker.json`, `OrderDetailPage.test.tsx` and `checks/domain/mock-status.ts`) change with those owners' review, and each owner's issue lists the mentions left in their own code.
- `pnpm api:generate` changes only the summaries in `apps/api/openapi.json` and the generated client's `endpoints/master-data/master-data.ts`, because the other 12 generated files carry only the wire names, and `pnpm api:check` passes.
- The fixture in `scripts/ci/changed-inputs.test.mjs` and the comment in `docker-compose.yml` use the planned `mock-business-central`.
- `git grep -i navision` lists only what the ADR keeps on purpose, the `RENAMED` map in `backlog.test.mjs` and this story's own text, and the pull request shows the list.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-84: SPR, the approver group and zero tolerance in the facts

The facts, names and personas follow the briefing: Stock Purchase Requisition, three management approvers, a coordinator and exact matching on four fields.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M1 design thinking, M2 GRS by design
- **Branch:** `chore/spr-approver-group`
- **Planned for:** Sprint 03 (W4)
- **Depends on:** P-83

Acceptance criteria:

- SPR reads Stock Purchase Requisition in `CLAUDE.md` and the docs, raised by the product manager from stock on hand and the last three months' run rate.
- `CLAUDE.md` and the docs say a coordinator, a Support user, routes each SPR to three management approvers, any one of whom decides, with no substitute and a reminder to the whole group after 24 hours.
- `CLAUDE.md` follows the briefing where else it differs, at lines 22, 30, 34 and 72 today: the countries and payment terms in its client paragraph, what links the two flows, an SPR no longer raised from an order's shortfall, and Management deciding above a limit only if limits are switched on.
- `docs/agile/hero-journey.md` says at line 24 today the SPR's pre-fill moves from the shortfall to stock on hand and the run rate with P-61, and E2E #1's steps stay as they are for `v0.1-proposal` (P-90 records the switch after the tag).
- Rachel Goh, made up, replaces the approver persona, and the personas name the other two made-up approvers, Marcus Teo and Farah Ismail, and the made-up coordinator, Michelle Lau, whom P-86 seeds.
- The old persona's real first name leaves every text file but prompt 001. Committed pictures keep it until their pages are re-shot, which P-107's roll-out does for every page, and Git history keeps it regardless.
- The role's label reads Management approver (item cy in the build report), and the stored `APPROVER` value stays.
- `CLAUDE.md` states that part number, quantity, unit price and currency match exactly across the PO, PI, invoice and packing list, with no tolerance setting for those four.
- An ADR records the briefing's facts, names the conflicts with ADR 0041's decisions 6, 8 and 10 for Angelyn to decide, and changes no logic of areas 2, 3 or 4.
- Azri's two test files that carry the persona's name, `workflow-spr-approval.test.ts` and `WorkflowsPage.test.tsx`, change only where they name it, with his review.
- `pnpm check:dashes`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-85: Record the 5 Nov briefing

The answers from 5 Nov in our own words, the assumptions settled, and each owner told what their logic now needs.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 2 points
- **Requirements:** M1 design thinking
- **Branch:** `docs/briefing-5-nov`
- **Planned for:** Sprint 03 (W4)
- **Depends on:** P-84

Acceptance criteria:

- `docs/client/questions-for-client.md` records the 5 Nov answers in our own words in its Answers table, and adds the new questions from Q-33.
- `docs/assumptions.md` replaces its older briefing section, marks each assumption Confirmed, Partly, Changed, Dropped or Open, and adds A-38 onwards.
- A-31 says samples may go to a cloud AI service that does not train on inputs, in a named region, only once Spectra's written line arrives, and `CLAUDE.md`, `AGENTS.md` and `docs/data-formats.md` agree.
- `CLAUDE.md` and the docs bring the purchase flow forward (A-20), and the six KPIs replace the five, each old measure mapped to a new one (item cz in the build report).
- One issue each for Azri, Angelyn and Iok Teck, filed right after P-82's seed and assigned to them, lists what their logic now needs and which area 1 stories wait on it.
- Nothing from the client pack is in Git or an issue: no staff names, figures, customer or vendor names, quotes or screenshots.

### P-86: Synthetic data from the briefing

The seeded set uses the brands, categories, countries, history and planted cases of the briefing, so Spark and the reports work on realistic data.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 13 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-briefing-data`
- **Planned for:** Sprint 03 (W4) and Sprint 04 (W5)
- **Depends on:** P-31, P-84

Acceptance criteria:

- Real brand names from prompt 005 section 2, with made-up part numbers in each brand's style and no logos, across components, peripherals, PCs, enterprise, security and networking, and an ADR records Richie's decision of 9 Nov to use them.
- Made-up customers in the eleven countries of prompt 005 section 10, each with an address and an obviously fake tax ID, prices in USD, and each customer's last agreed price for each item, with no price tables.
- 24 months of orders and sales with seasonality, each item's three-month run rate and months of cover, and vendor lead times as in prompt 005 section 9.
- The 120 live samples stay apart from the 24 months of history, so the lists and the tracker still read the 120, and each owner is asked to review any of their tests that pin them, such as `apps/api/src/modules/checks/checks.test.ts`.
- The planted cases exist: a PO for more than is in stock, a PI whose price differs from its PO, and an AWB draft with the wrong consignee.
- The people include three management approvers and the SPR coordinator, and the first approver stays the demo persona.
- The order form's reference price becomes the customer's last agreed price for the item, as context only, in place of the list price.
- The price-list leftovers go: `docs/data-formats.md`, the sample exception in `packages/synthetic-data/src/exceptions.ts`, and the demo PO's purpose and a comment in `packages/synthetic-documents`, with `pnpm docs:generate` run again.
- The docs that pin the old data set follow: `CLAUDE.md`'s row for `packages/synthetic-data`, `docs/agile/test-plan.md` and `docs/requirements-traceability.md`.
- The seed stays deterministic and date-relative and runs in 30 seconds or less, the list endpoints are timed before and after and are no slower, and every test that pins a figure changes in the same pull request.
- Check: prompt 003 section 4, for every role it touches, at 1440 by 900 and 390 by 844.

### P-106: Three visual directions

Ink, Paper and Spectra, each shown on the home page and one order page, so Richie picks one before anything rolls out.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-design-directions`
- **Planned for:** Sprint 03 (W4) and Sprint 04 (W5)
- **Depends on:** P-22

Acceptance criteria:

- Each direction names its palette, type and radius, with tokens for colour in light and dark, one UI typeface with tabular figures, at most 7 type sizes, spacing, elevation and motion.
- The home page and one order page, at 1440 by 900 in light and dark, for each direction, are in `docs/design/directions/`.
- The Spectra direction uses our own teal and navy in the spirit of Spectra's deck, with no colour sampled from the client pack and no logo (Q-23).
- `docs/design/review-board.md` holds the three directions, and Richie's pick is recorded in `docs/design/design-system.md` before anything rolls out.
- Icons are Lucide only.

### P-107: Roll the picked direction onto the shell and templates

The chosen direction goes onto the app shell, the list page, the document form and the cards, and every later screen starts in it.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-direction-rollout`
- **Planned for:** Sprint 05 (W6)
- **Depends on:** P-106

Acceptance criteria:

- The tokens, shell, list template, document form and cards use the chosen direction, with dark mode as good as light.
- Each kit item is adapted to the tokens, one component to a file, with a header comment naming its vendor, the item and its licence.
- Pro parts appear only on Richie's pages and the shell, and area screens use free kits unless Richie confirms a team licence.
- Every page it touches has a before and after in `docs/design/review-board.md`.
- `pnpm budget` passes and Lighthouse stays at 90 or more.
- Every page is re-shot in the new direction, which also replaces the older pictures that still show the old persona's real first name (P-84).
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

### P-108: The landing page

The constellation as hero, the tagline, three steps, a short Spark exchange and Spectra's own measures.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-landing`
- **Planned for:** Sprint 11 (W12)
- **Depends on:** P-23, P-107

Acceptance criteria:

- The constellation is the hero once Richie approves its capture, with the tagline and the three steps.
- A short scripted Spark exchange plays out, and Spectra's own measures from prompt 006 section 3 appear.
- Sign in and Try the demo, with one primary button.
- A still image for reduced motion or no WebGL, and the 3D stays a lazy chunk.
- Lighthouse 90 or more and LCP under 2.5 s.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark, with a short capture of the motion.

### P-109: The sign-in page with the scene

The split sign-in layout with a React Bits background now, and the scene once it is approved.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-sign-in-scene`
- **Planned for:** Sprint 06 (W7)
- **Depends on:** P-107

Acceptance criteria:

- A React Bits background sits behind the sign-in form, replaced by the scene once P-23's capture is approved, with a still version for reduced motion.
- The demo role buttons stay one click each.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark, with a short capture of the motion.

### P-110: The speed bar

The keyboard and speed rules of prompt 006 section 4 that the product pass left out.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-speed-bar`
- **Planned for:** Sprint 07 (W8)
- **Depends on:** P-41, P-107

Acceptance criteria:

- The question-mark key opens a list of every shortcut, and P-41's setting turns the single-key shortcuts off.
- Optimistic updates on actions that can be undone, and prefetching on hover for record links.
- Component tests cover the keyboard path, and a Playwright test opens the list.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

### P-111: Grid polish

Resizable columns, sticky headers on every grid, arrow keys between cells, and inline editing where a screen declares it.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-grid-polish`
- **Planned for:** Sprint 13 (W14)
- **Depends on:** P-45, P-107

Acceptance criteria:

- Columns resize by mouse and keyboard, and saved views keep the widths.
- Every grid has a sticky header, and arrow keys move between cells.
- Grids that declare it edit inline, with validation and Undo.
- Rows stay 36 to 40 px high, and numbers stay right-aligned in tabular figures with their currency.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

### P-112: Small delights

KPI numbers count up, sparklines draw in and empty states get an illustration of our own, on first view only.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-small-delights`
- **Planned for:** Sprint 13 (W14)
- **Depends on:** P-107

Acceptance criteria:

- A shared count-up and draw-in in `components/common` runs on first view only, never on tables or forms in use, and area 3 may adopt it on its KPI page.
- Each empty state has a simple illustration of our own and its next action.
- Reduced motion shows the final value at once.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark, with a short capture of the motion.

## Epic A: Document intake and AI extraction

Email or upload; classification; extraction with a confidence score and a source link per field; layout mappings that AI proposes and a person approves; the document cabinet and audit packs.

### A-1: Classification

AI tells the document types apart, for the sales pilot's PO upload.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Depends on:** P-17, P-18

Acceptance criteria:

- AI classification tells document types apart on upload.
- It runs through the AI gateway, and the result stays a draft until a person confirms it.

### A-2: Extraction with confidence and provenance

AI reads the fields from POs, PIs, invoices and packing lists, and every field shows how sure it is and where it came from.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Depends on:** A-1

Acceptance criteria:

- AI extraction reads fields from POs, PIs, invoices and packing lists, with confidence scores and human review.
- Every extracted field keeps its confidence and source, with a source link per field.
- AI output is a draft until a person confirms it.

### A-3: Layout mapping, proposed by AI and approved by a person

A new customer layout is mapped by AI and approved by a person (E2E #2).

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Depends on:** A-2

Acceptance criteria:

- AI proposes a mapping for a new layout, and a person approves it.
- E2E #2 passes: a new layout is mapped by AI and approved by a person.

### A-4: Learning from corrections, one layout at a time

A person's corrections improve extraction, one layout at a time.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Depends on:** A-3

Acceptance criteria:

- A person's corrections feed back into extraction, one layout at a time.

### A-5: Email intake through a mock mailbox with signed webhooks

Documents arrive by email as well as by upload, through a mock mailbox.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 08 (W9)
- **Depends on:** P-18

Acceptance criteria:

- Email intake runs through a mock mailbox with signed webhooks.
- No real customer email is read or sent.
- It is the proof of concept's email inbox (prompt 005 section 1), and a file saved out of WhatsApp can be forwarded to it.

### P-92: Document cabinet: filing and search

Every document is filed on arrival with the fields the AI read and a link to its order, and found from one search box.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-document-cabinet`
- **Planned for:** Sprint 07 (W8)
- **Depends on:** P-37, P-53, P-107

Acceptance criteria:

- Each document is filed on arrival with its type, company, PO number, document number, date, amount, status, who stored it and a link to its order, or for a vendor's document to its vendor PO once P-101 brings them.
- One search box and filters for company, PO number, type, date, status and who stored it, on a results grid on the list template.
- Full-text search, and fuzzy part-number search with `pg_trgm`, indexed and paged on the server.
- Results respect masking and the permission to read, tested on the bytes of the response.
- API tests for 401, 403, 404 and validation, and a Playwright test that finds a document by its PO number.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

### P-93: Cabinet viewer: stamps, notes and the related chain

Around each document: its related chain, stamps with who and when, notes, and a match badge on every pair.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-cabinet-viewer`
- **Planned for:** Sprint 07 (W8) and Sprint 08 (W9)
- **Depends on:** P-91, P-92, P-107

Acceptance criteria:

- Each PO shows its chain of PI, invoice, packing list and AWB/BL, with a match badge on each pair that opens the compare screen.
- A viewer with zoom, page thumbnails, stamps such as Checked and Verified with who and when, and notes, and the stamps also show on the compare screen.
- Stamps and notes are a person's records, audited, and removing one asks for a reason and deletes nothing.
- Stamping needs its own permission, checked on the server.
- API tests for 401, 403, 404 and validation, and a Playwright test that stamps and notes a document.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

### P-94: Audit packs

Pick a customer, a vendor, a month or an order, and download every document with an index, in seconds.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-audit-packs`
- **Planned for:** Sprint 08 (W9)
- **Depends on:** P-92, P-107

Acceptance criteria:

- A pack's scope is a customer, a vendor, a month or an order, and it downloads as a zip of every document plus an index PDF, made with pdf-lib (ADR 0033), saying what each is, when it came in and who checked it.
- A pack for one month of the synthetic set is ready in seconds, and its build time is recorded for the KPI.
- Every download is an audit event with who, the scope and when, in the shape Angelyn agrees in her issue.
- Only roles with the permission may build a pack, the server enforces it, and masked fields stay masked in the index.
- API tests for 401, 403, 404 and validation, and a Playwright test that downloads a pack.
- Documents stay in OrderPilot's own storage: MinIO today, and storage hosted in Singapore once P-24 deploys (ADR 0031). A copy to a SharePoint folder is an option for later and is not built here.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

## Epic B: Master data and Business Central

Items, customers, vendors and stock behind a connector, with each customer's last agreed price as context and no price tables; any write-back needs a preview and an approval.

### B-1: Duplicate-PO protection

The same PO never creates a second order.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Depends on:** P-18

Acceptance criteria:

- No duplicate orders: a repeated PO is caught.
- A PO a person confirms as a revision of an existing order is that order's next version (P-89), never a duplicate, and a re-sent PO is still caught.

### B-2: A Business Central import file

Confirmed data leaves as a file Business Central can import, beside Business Central and never instead of it.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Depends on:** P-20

Acceptance criteria:

- A Business Central import file is produced from data a person has confirmed.
- Any write-back needs a preview and an approval, and nothing posts automatically.

### B-3: The template engine for PIs, invoices, packing lists and Excel

One engine for every generated document, used by areas 2 and 3.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Depends on:** P-18

Acceptance criteria:

- The template engine produces PIs, invoices, packing lists and Excel.
- Areas 2 and 3 use it.
- React-PDF and ExcelJS render the template engine's PDF and Excel output with an ADR, a pinned version and a traceability row.
- It also renders the credit note and the reissued invoice that area 2's reverse and reissue needs, and the PI carries bank details that are synthetic and obviously fake.

### B-4: QR codes on generated documents and carton labels

QR codes for the warehouse to scan.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Depends on:** B-3

Acceptance criteria:

- Generated documents and carton labels carry QR codes for the warehouse to scan.

### P-88: Customer check on intake and the new-customer card

A PO's customer is found in Business Central by name, address and tax ID, and a new customer gets a pre-filled card for approval.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-customer-check`
- **Planned for:** Sprint 06 (W7)
- **Depends on:** P-20, P-53, P-55, P-68, P-86, P-107

Acceptance criteria:

- Name, address and tax ID find ranked candidate customers, a person confirms one, and the order stores its Business Central number, never a name.
- A new customer opens a pre-filled customer card that a person edits and sends for approval.
- A second person approves the card after a preview of exactly what goes to mock Business Central, and nobody approves their own card.
- Every step is audited, and nothing is written without the preview and the approval, through P-20's write path.
- A Playwright test takes a PO from a new customer through the card to a draft order.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

### P-101: Vendor POs

The product manager places the vendor PO from an approved SPR, or records the vendor portal's reference.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-vendor-pos`
- **Planned for:** Sprint 10 (W11)
- **Depends on:** P-20, P-100

Acceptance criteria:

- A vendor PO is made from an approved SPR, with the vendor matched on its Business Central number, and goes to mock Business Central only after a preview and an approval.
- For a vendor whose portal takes the PO, the portal's reference is recorded instead and no PO is written.
- Only the product manager places it, the AI never does, and no PO comes from an unapproved SPR.
- Every step is audited, with `.http` requests and API tests for 401, 403, 404 and validation.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

### P-103: Goods receipt and inwarding

The warehouse counts goods against what was expected, and a person confirms the inwarding into mock Business Central.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-goods-receipt`
- **Planned for:** Sprint 10 (W11) and Sprint 11 (W12)
- **Depends on:** P-20, P-101

Acceptance criteria:

- A receipt shows the expected quantities beside what was counted, and a difference is flagged for a person.
- Inwarding writes to mock Business Central only after a preview and a person's confirmation, never on its own.
- The receipt screen works on a tablet, with touch targets of 44 px or more.
- Every step is audited, with API tests for 401, 403, 404 and validation.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

## Epic C: Order workflows and approvals

A state machine; tasks for each role; SPR approval within limits; the payment gate; reminders and escalations; generated PIs, invoices and packing lists.

### C-1: Area 2 base, the workflow module

Azri's head start: the models, contracts, screens and test skeletons, never the area's core logic.

- **Area:** `area: 2 order workflows and approvals`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-10, P-11, P-12

Acceptance criteria:

- Models: workflow definitions, instances, tasks, events and notifications.
- OrderPilot's own numbers for its records, like `SPR-20261102-0001`, beside Business Central's.
- Payment confirmation records the payment type, and prepayment drives the payment gate.
- Configurable fields and default values for each document type, as configuration, not code.
- The SPR pre-fill is a suggestion from stock levels that a person approves.
- Contracts, with routes returning typed mock data in Swagger.
- Screens wired to those routes, covering every state: each role's task inbox; an order's steps and timeline; the SPR approval page (approve or reject, with a comment); reminders.
- To-do tests, as `it.todo` with the key cases named: transitions, SPR limits, the payment gate, reminders and escalations, and retries with idempotency.
- The "What the base gives you" and "What's yours to build" sections of the guide are filled in.
- Left to Azri: his state machine, which he writes again himself as his first story, so it stays his work; Spectra's sales and purchase flows, the SPR rules, the payment gate and the SLA logic.
- Azri's review is requested on the pull request once he is a collaborator, and Richie is told when it merges, so he can hand it over.

### C-2: The order state machine for the sales flow

Azri writes his own state machine, with the sales flow's states and transitions, so that order status lives in one place and stays his work.

- **Area:** `area: 2 order workflows and approvals`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** C-1

Acceptance criteria:

- Azri writes the state machine himself, as his first story, so that it stays his work (C-1 leaves it to him).
- Its states and transitions follow the sales flow: the PO arrives; stock is checked and an SPR raised when needed; Support generates the PI; the customer pays; the warehouse packs; the invoice and packing list are made; the goods go to the forwarder; the customer gets the shipping details; the AWB/BL and import permit are followed up.
- Where they meet, its states map to Business Central's Sales Header Status (Open, Released, Pending Approval, Pending Prepayment), as an assumption to confirm at the briefing call.
- Order status lives only in this state machine. Other areas read it or send events, and never set status themselves.
- Each transition names the role that may make it, and area 4's policy is called on the server before it happens.
- The payment gate guards packing: with the prepayment type, packing waits for Finance's confirmation.
- Area 3's checks report pass or fail, and a failure holds the order rather than moving it on.
- Every transition is a domain event with who, when, and the state before and after, for the tracker and the audit trail.
- An illegal transition is refused with the one error envelope, and audited.
- Unit tests cover every legal and every illegal transition, replacing C-1's `it.todo` cases for transitions, and all of them pass.
- The states and transitions are written down in area 2's guide.

### C-3: SPR approval within limits

An SPR goes to an approver who may decide it within their limit, set up in the shape of Business Central's Approval User Setup.

- **Area:** `area: 2 order workflows and approvals`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** C-1

Acceptance criteria:

- The approval setup has the shape of Business Central's Approval User Setup: user, approver, Sales Amount Approval Limit, Purchase Amount Approval Limit, Unlimited Sales Approval, Unlimited Purchase Approval, and a substitute.
- Approvers, limits and delegation are configuration, not code, until Spectra confirms them.
- An approver approves or rejects an SPR within their limit, with a comment, on C-1's SPR approval page.
- An SPR above the approver's limit goes on to an approver whose limit covers it, or one with an unlimited approval, and is never approved below it.
- While an approver is away, their substitute receives the SPR.
- Area 4's policy is called on the server for each decision, and enforces no self-approval: whoever raised an SPR never approves it.
- The AI may pre-fill an SPR, but only a person approves it, and every decision is audited.
- Tests cover approval within the limit, above it and exactly at it, unlimited approvers, a substitute, and a refused self-approval, replacing C-1's `it.todo` cases for SPR limits.

### C-4: Reminders and escalations

A task that waits too long reminds its owner, then escalates, so that no follow-up goes overdue unseen.

- **Area:** `area: 2 order workflows and approvals`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** C-1

Acceptance criteria:

- Each task type has a due time from configurable SLA settings, not code.
- A reminder goes to the task's owner before the due time, and an escalation goes to whoever the configuration names once the task is overdue.
- Reminders and escalations run as queued jobs with idempotency keys, so a retried job never sends one twice.
- Each reminder and escalation is an in-app notification, and a workflow event the tracker uses for its overdue flag (D-4).
- A reminder to a customer or a vendor is a draft that a person sends, never sent on its own.
- Every overdue follow-up is visible.
- The reminder in E2E #1, the sales pilot, comes from this story.
- Tests cover a reminder before the due time, an escalation after it, a task finished in time getting neither, and a retried job sending once, replacing C-1's `it.todo` cases for reminders, escalations and retries.

### C-5: Area 2 polish left out of the base

What the base left out because no teammate needs it this week.

- **Area:** `area: 2 order workflows and approvals`
- **Priority:** should
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Planned for:** Sprint 03 (W4)
- **Depends on:** C-1

Acceptance criteria:

- The cue tiles on each role's home page show live counts (my tasks, SPRs awaiting approval, payments to confirm) from the workflow routes, once the tile system can take a count.
- A document settings screen edits the field settings and defaults held in DocumentTypeConfig, with an audit event for each change.
- The mock read model is replaced by one that reads WorkflowInstance, WorkflowTask and WorkflowNotification, and the routes drop meta.mock.

### P-89: PO versions

A revised PO is the next version of the same order, shown with its differences.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `feat/area1-po-versions`
- **Planned for:** Sprint 06 (W7)
- **Depends on:** P-49, P-51, P-55, P-107

Acceptance criteria:

- A PO with the same customer and PO number becomes the next version of that order only when a person confirms it revises the existing order. Otherwise the 409 stays the answer to a re-sent PO, and an ADR amends ADR 0047's duplicate rule.
- The order page lists every version and shows the differences between two, field by field and line by line.
- An earlier version stays readable and marked superseded, and nothing is deleted.
- The version number has its own name, because `version` in `packages/shared/src/orders.ts` is already the edit token.
- Each check result shows which version it ran on.
- `.http` requests and API tests for 401, 403, 404, validation and a third version.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

### P-90: The short-stock revision request

When a PO asks for more than is available, a person sends a drafted request to revise it, and the revised PO joins the order.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-short-stock-request`
- **Planned for:** Sprint 06 (W7) and Sprint 07 (W8)
- **Depends on:** P-87, P-89, P-107

Acceptance criteria:

- An order whose lines ask for more than is available shows each line's shortage and offers Ask for a revised PO.
- The draft asks the customer to revise the PO to the available quantity at the PO's price, and a person edits and sends it.
- The revised PO joins the same order as its next version, and no partial shipment or back order is offered.
- The hold is area 2's state, read through its route, and Azri reviews the pull request.
- After the `v0.1-proposal` tag, E2E #1 takes this request in place of an SPR raised from a short line, and `CLAUDE.md` and `docs/agile/hero-journey.md` follow. An SPR raised from the item's cover and decided by one of the three joins it with P-100.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

### P-100: SPR screens: routing, the 24-hour reminder and where it is stuck

The platform side of the SPR flow: the coordinator's screen, the 24-hour reminder email, and where each SPR is stuck.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-spr-routing-screens`
- **Planned for:** Sprint 09 (W10) and Sprint 10 (W11)
- **Depends on:** C-4, P-61, P-71, P-87

Acceptance criteria:

- The coordinator routes an SPR to the approver group and hands an approved one back to the product manager, through area 2's routes.
- Each SPR shows its step, who holds it, how long it has waited and a countdown to the 24-hour reminder with P-71's timer, and the approvers' own screen stays P-72.
- When area 2's sweep calls the reminder port at 24 hours, the hook Azri's issue names, one email per group member goes once through the mail sender to Mailpit only, and a Playwright test sees it.
- A where-is-it-stuck list shows every open SPR by step and age, for the product manager and the coordinator.
- The screens live in area 1's folders, the state machine's rules stay Azri's, and he reviews the pull request.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

### P-102: Inbound shipments and chase drafts

An inbound shipment keeps its promised and expected dates, and drafts a chase email when it slips.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `feat/area1-inbound-shipments`
- **Planned for:** Sprint 10 (W11)
- **Depends on:** P-63, P-87, P-101

Acceptance criteria:

- An inbound shipment holds the vendor PO, the forwarder, the AWB or BL, and the promised and expected dates.
- When the expected date passes the promised one, a chase draft is made for a person to edit and send.
- The vendor's usual lead time shows beside the dates.
- `.http` requests and API tests for 401, 403, 404 and validation.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

## Epic D: Checks, the tracker and insights

Documents checked against each other, exactly on part number, quantity, unit price and currency and as warnings elsewhere; an exceptions queue; one tracker with every order's trail; Spectra's measures as KPIs.

### D-1: Area 3 base, checks and the tracker

Iok Teck's head start: the models, contracts, screens and test skeletons, never the area's core logic.

- **Area:** `area: 3 checks tracker and insights`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-10, P-11, P-12

Acceptance criteria:

- The checks module: a check-rule Strategy interface; check-result and exception contracts; an empty exceptions model.
- Contracts, with routes returning typed mock data in Swagger.
- Screens wired to those routes, covering every state: the order tracker (status, owner, overdue flags); an order's detail timeline; the exceptions queue; a KPI dashboard of Spectra's five measures.
- An order's page in the tracker shows each step and its effect, such as "payment confirmed: packing released". Money postings stay in Business Central.
- To-do tests, as `it.todo` with the key cases named: the MVP mismatch (the packing list's quantity against the PO), tolerances, and the KPI formulas.
- The "What the base gives you" and "What's yours to build" sections of the guide are filled in.
- Left to Iok Teck: every check and its tolerance, the exceptions flow, the tracker's logic and the KPIs.
- Iok Teck's review is requested on the pull request once they are a collaborator, and Richie is told when it merges, so he can hand it over.

### D-2: The packing-list quantity check against the PO

The MVP mismatch: a packing list whose quantity differs from the PO is flagged, and the result goes to area 2.

- **Area:** `area: 3 checks tracker and insights`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** D-1

Acceptance criteria:

- A check rule on D-1's Strategy interface compares each packing-list line's quantity with the matching PO line.
- Lines match on the item's Business Central number, never on its name. A look-alike name is shown as a possible match.
- A difference outside the tolerance fails the check. The tolerance is configuration, and zero until Spectra says otherwise.
- The result, pass or fail with each differing line, is reported to area 2, which decides what happens to the order.
- A failure raises an exception in the exceptions queue (D-3), linked to both documents.
- It is a fixed rule, not AI. The AI may explain the exception, but never decides it.
- Every seeded quantity mismatch in the synthetic documents is flagged.
- Tests cover equal quantities, a short and an over quantity, a missing line, an extra line and the tolerance's edge, replacing D-1's `it.todo` cases for the MVP mismatch and tolerances.

### D-3: The exceptions queue flow

Exceptions are worked from one queue: assigned, explained, and resolved or waived, with every step recorded.

- **Area:** `area: 3 checks tracker and insights`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** D-1

Acceptance criteria:

- Each exception gets OrderPilot's own number, like `EXC-20261102-0001`.
- An exception moves through its states (a first proposal: open, assigned, resolved and waived), and each step records who made it and when.
- Each exception has an owner and a due time, and an overdue one is flagged.
- Resolving or waiving an exception needs a reason, and every step is audited.
- Resolving an exception reports pass to area 2, so that the order can move on.
- D-1's queue screen filters by type, owner, state and age, with the common data table's quick search and saved filters (P-12).
- An AI summary may explain an exception, labelled as AI, and the logs stay the source of truth.
- Tests cover each state change, a change refused for want of a reason, and the overdue flag.
- The KPI dashboard shows trends over a period, and each of the five measures is a tested formula over events (D-1 shows fixed mock lab estimates).

### D-4: The tracker's status, owner and overdue flags from workflow events

One tracker shows every order's status, owner and overdue flags, fed by area 2's workflow events and never set by hand.

- **Area:** `area: 3 checks tracker and insights`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** D-1

Acceptance criteria:

- The tracker takes each order's status from area 2's workflow events. It never stores or sets a status of its own.
- Each order shows its current step, the role and the person who hold it, and how long it has waited.
- An order or a follow-up past its due time is flagged overdue, and every overdue follow-up is visible.
- An order's page shows each step and its effect, such as "payment confirmed: packing released". Money postings stay in Business Central.
- Until P-15's event bus exists, it works from the typed events in the order and event contract (P-7).
- It filters by status, owner, area and overdue, with the common data table (P-12).
- The overdue count feeds the KPI dashboard's overdue-orders measure.
- Tests cover a status change from an event, a change of owner, the overdue boundary, and the same event received twice.
- An order's page lists the documents behind each check side by side, with the differing line marked (D-1 leaves this out).
- The operation log at the foot of an order's page is fed from the audit trail once F-2 lands (D-1 shows mock rows).
- Role home tiles show real counts, such as orders waiting on me, and an end-to-end spec covers the tracker (D-1 leaves both out).

### P-91: The compare screen

Two documents side by side, with both values highlighted on their pages, for every difference a check found.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-compare-documents`
- **Planned for:** Sprint 06 (W7) and Sprint 07 (W8)
- **Depends on:** P-54, D-2, P-107

Acceptance criteria:

- Two documents show side by side, with each differing value highlighted on both pages, scaled with the zoom, in both themes.
- A list of the differences sits beside them, each marked as blocking or a warning, and choosing one scrolls both pages to it.
- Page thumbnails, zoom and full keyboard use, and at 390 px the pages stack with a way to switch. Stamps join both pages with P-93.
- The screen reads area 3's check results and computes nothing, it takes over D-4's side-by-side criterion, and Iok Teck reviews the pull request.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

## Epic E: AI with a person in the loop

Extraction, mismatch explanations, drafts that a person sends, and Spark, the read-only assistant.

### E-1: The review screen, with source highlighting

A person confirms the uncertain fields, with each one shown on the source document.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Depends on:** A-2

Acceptance criteria:

- A person confirms the uncertain fields on the review screen.
- Each field's source is highlighted on the document.
- AI confidence is shown with "Requires approval".

### E-2: The accuracy harness, with a 95% target and a comparison of models

Extraction accuracy measured against the synthetic documents' ground truth.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Depends on:** A-2, P-21

Acceptance criteria:

- The harness measures extraction accuracy on the synthetic test set, against a target of 95% or more.
- It compares models.
- promptfoo runs the accuracy set in CI with an ADR, a pinned version and a traceability row.

### E-3: Prompt-injection tests

Tests that prove a hostile document cannot steer the AI.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 3 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Depends on:** P-17

Acceptance criteria:

- Tests show that documents are treated as data, the model only returns fields or asks for a read-only tool that runs as the person asking, and no model output writes, approves, posts, pays or sends.
- promptfoo runs the prompt-injection tests in CI with an ADR, a pinned version and a traceability row.

### E-4: Passkeys to confirm risky approvals

A passkey confirms a risky approval, with area 4's policy deciding when.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Depends on:** P-10, F-1

Acceptance criteria:

- A passkey confirms a risky approval.
- Area 4's policy decides when one is needed.

### E-5: A first-run guided tour for each role

A short tour of the menu the first time each role signs in, which also walks the demo.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 3 points
- **Requirements:** M1 design thinking, M4 best practices
- **Depends on:** P-11

Acceptance criteria:

- A first-run tour of the menu for each of the nine roles, showing that role's own tasks.
- It can be skipped, and restarted from the user menu.
- It meets WCAG 2.2 AA: full keyboard use, focus kept in place, and reduced motion respected.
- Its text comes from react-i18next, with no hard-coded strings.
- It is in our own design and words, copied from no other product.
- It helps the demo: the tour for each role follows the sales pilot.

### E-6: An "Ask OrderPilot" help panel that answers from our docs

A help panel that answers questions from OrderPilot's own docs, labelled as AI-generated and for reference only.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M3 AI-assisted coding
- **Depends on:** P-11, P-17, P-96

Acceptance criteria:

- The panel answers from OrderPilot's own docs only, and links the pages it used.
- Every answer is labelled as AI-generated and for reference only.
- It goes through the AI gateway (P-17), with the mock provider by default, and each answer is tracked like any other AI call.
- It never acts: it cannot approve, change data or call another endpoint.
- Questions and docs are treated as data, and the prompt-injection tests cover it (E-3).
- Area 4's policy decides which provider may receive a question, and no business data goes with it.
- It opens as one more read-only tool inside Spark's panel (P-96), never as a second assistant.

### P-87: Drafts that a person sends

One draft record and card for every message OrderPilot proposes, which a person edits and sends, never the system.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-drafts`
- **Planned for:** Sprint 05 (W6)
- **Depends on:** P-17

Acceptance criteria:

- A `Draft` record holds its kind, the order or SPR it belongs to, the recipient, subject and body, who drafted it and who sent it, with `.http` requests and API tests for 401, 403, 404 and validation.
- A draft card that a person edits and then sends, where sending reaches only Mailpit in development and demos and keeps the sent text.
- A mail sender that can only reach Mailpit, with an ADR and a pinned version: the Mailpit container and the `SMTP_*` settings exist today and no sender does, so the first of this story and P-59 to merge brings it, and the other reuses it.
- A draft from the AI says AI draft and Requires approval, and nothing leaves until a person presses Send.
- Every draft, edit and send is audited with who and when.
- A Playwright test: an allowed role edits and sends a draft, and a role without the permission gets a 403 from the server.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

### P-95: Spark's foundation

Spark runs through the AI gateway with read-only tools, keeps each person's conversations, and audits every question and answer.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M3 AI-assisted coding, M4 best practices
- **Branch:** `feat/area1-spark-foundation`
- **Planned for:** Sprint 08 (W9)
- **Depends on:** P-17, F-1

Acceptance criteria:

- Conversations and messages are kept for each person and nobody else can read them, with API tests for 401, 403, 404 and validation.
- Tool calling runs through `LlmGateway`, the tools call our own services, and the model never writes SQL.
- Every tool is read-only and runs with the asking person's permissions through area 4's policy, so Spark sees only what that person may see.
- Every answer cites its sources, as links to documents and orders or the query behind a chart, and outside its tools Spark says what it cannot do.
- A deterministic mock provider with scripted answers to the demo questions keeps tests and offline demos working.
- Every question and answer is audited, with its tokens and cost tracked like any AI call.
- Prompt-injection tests show that a hostile document cannot make Spark call a tool or change anything.
- `CLAUDE.md` section 5, and the GRS doc and area 1's guide where they repeat it, say that no model output writes, approves, posts, pays or sends, and that tools are read-only and run as the person asking.
- ADR: Spark and its read-only tools.

### P-96: Spark's panel and page

A side panel that opens from anywhere and a full page, with Spectra's own prompts when empty, built for a phone too.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Branch:** `feat/area1-spark-panel`
- **Planned for:** Sprint 08 (W9) and Sprint 09 (W10)
- **Depends on:** P-15, P-95, P-107

Acceptance criteria:

- A side panel opens from a top-bar button or a shortcut that does not clash with Ctrl+K, and a full page lists the person's conversations.
- The empty state suggests prompts in Spectra's words: matching a customer's invoice, packing list and AWB, collecting a month's documents, and a brand's six months of sales as a graph.
- Sources are chips that open the document beside the chat, drafts are cards a person edits and sends, and an audit pack is a card with its download.
- A short glow as the panel opens and a quiet shimmer while an answer streams over P-15's live updates, with a still version for reduced motion.
- Spark has an icon of our own and no vendor logo.
- The panel and page work by keyboard, keep focus, and work at 390 by 844.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark, with a short capture of the motion.

### P-97: Spark finds documents

Spark finds documents by customer, vendor, PO number, type, date range or status, with full text and fuzzy part numbers.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-spark-find`
- **Planned for:** Sprint 09 (W10)
- **Depends on:** P-92, P-95

Acceptance criteria:

- A tool takes the filters and a text query, searches the cabinet through its service, and answers with links.
- A part number with a typo is still found through `pg_trgm`, with a test.
- Results hold only what the asker may see.
- Scripted mock answers cover the demo questions.
- Tests cover each filter, an empty result and a refusal.

### P-98: Spark matches a set and collects an audit pack

Spark runs area 3's checks over a set of documents and explains each difference, and collects an audit pack, changing nothing.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-spark-match-and-pack`
- **Planned for:** Sprint 09 (W10)
- **Depends on:** D-2, P-94, P-95

Acceptance criteria:

- A tool runs area 3's on-demand, read-only check of a named document set (PO, PI, invoice, packing list and AWB/BL), which Iok Teck's issue asks for, and explains each difference in a sentence that links both pages.
- A second tool builds an audit pack through P-94 for the scope the person names, and answers with the download card.
- Spark never approves, waives or fixes a difference.
- Scripted mock answers cover matching a customer's invoice, packing list and AWB, and collecting a month's documents.
- Tests cover a clean set, a set with differences and a refused pack.

### P-99: Spark answers order questions

Where is order X, what is waiting for me, and what has been stuck for more than N hours.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-spark-order-questions`
- **Planned for:** Sprint 09 (W10)
- **Depends on:** D-4, P-95

Acceptance criteria:

- Three tools read the tracker, the person's own work and the time at each step, through their services.
- An answer names the step, the role and the person holding the order, and how long it has waited, with a link.
- What is waiting for me matches the home page's Needs you for the same person.
- Tests cover each question, an order the person may not see, and an unknown order.

### P-105: Spark's charts, forecast and customer replies

Spark draws area 3's figures as charts and forecasts, and drafts a reply to a customer's stock inquiry.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-spark-charts-and-replies`
- **Planned for:** Sprint 11 (W12)
- **Depends on:** P-87, P-96

Acceptance criteria:

- Charts of sales by brand, item, customer or country by month, and of PO-to-delivery time by vendor, are drawn by our chart components from area 3's services, each with the query behind it and Open in dashboard.
- A six-month forecast shows its range and its method in one sentence.
- A stock check answers an inquiry and drafts a reply that a person edits and sends.
- Every chart has a data-table view for screen readers, and Spark never sends anything.
- Scripted mock answers cover a brand's six months of sales as a graph.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

## Epic F: Financial controls and governance

No self-approval; approval limits; bank-detail change control; masking of bank details and prices by role; a tamper-evident audit trail.

### F-1: Area 4 base, access policy and masking

Angelyn's head start on policy and masking: the mechanism and contracts, never the real rules.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-10, P-11, P-12

Acceptance criteria:

- Policy and masking: a role-permission matrix screen; the masking mechanism, with a neutral sample rule; classification contracts; the contract for what data may go to which AI provider; how a refusal looks.
- Role permissions plus a data scope, such as a Product Manager seeing only their brands' orders.
- A role's permissions can be copied to another role, and users are disabled, never deleted.
- Payment confirmation records the payment type, for the policy to use.
- Contracts, with routes returning typed mock data in Swagger, and screens covering every state.
- To-do tests, as `it.todo` with the key cases named: approval limits; no self-approval; the bank-detail hold; masking for each role; a direct API call being refused (E2E #3).
- The "What the base gives you" and "What's yours to build" sections of the guide are filled in.
- Left to Angelyn: the real policy, limits, segregation-of-duties rules, the bank-detail control and the masking rules.
- Angelyn's review is requested on the pull request once they are a collaborator, and Richie is told when it merges, so he can hand it over.

### F-2: Area 4 base, the audit viewer

The audit log viewer over the real hash chain.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-9, P-10, P-11, P-12

Acceptance criteria:

- The audit log viewer over the real hash chain, with filters and a chain check.
- To-do tests, as `it.todo`, for export and retention.
- Angelyn's review is requested on the pull request once they are a collaborator, and Richie is told when it merges, so he can hand it over.
- Anchor the latest audit hash outside the database (a signed daily export) and verify the trail on a schedule, so tampering by someone with the database owner's rights is caught early. P-9 provides `AuditService.verify` (ADR 0010).

### F-3: The authorisation policy with approval limits

Area 4's policy decides on the server who may do what, up to which amount, and every endpoint calls it.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** F-1

Acceptance criteria:

- One policy, called on the server by every endpoint that acts. Hiding a button is never the control.
- Role permissions plus a data scope, on F-1's matrix: for example, a Product Manager sees only their brands' orders.
- Approval limits in the shape of Business Central's Approval User Setup (approver, Sales Amount Approval Limit, Purchase Amount Approval Limit, Unlimited Sales Approval, Unlimited Purchase Approval, substitute), the same shape area 2's SPR approval uses (C-3).
- Limits and approvers are configuration until Spectra confirms them.
- An action above the actor's limit is refused, the way F-1 shows a refusal.
- Every refusal is audited: who, what, when and why.
- A direct API call without the permission is refused (E2E #3).
- Tests cover each role's allowed and refused actions, the data scope, each limit's edge and unlimited approvers, replacing F-1's `it.todo` cases for approval limits.

### F-4: No self-approval and segregation of duties

Nobody approves their own request, and the duties that must stay apart stay apart, on the server.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** F-1

Acceptance criteria:

- Whoever raised a request never approves it, whatever their role or limit.
- A substitute who raised the request is refused too.
- `SYSTEM_ADMIN` configures the platform, and never approves, posts or pays.
- The duties to keep apart are configuration. They start with: raising and approving an SPR; confirming a payment and clearing a payment hold; changing a vendor's bank details and approving a payment to that vendor.
- Every refusal is audited, and shown the way F-1 shows a refusal.
- Segregation of duties holds in E2E #3.
- Tests cover self-approval through the API, through a substitute and after a change of role, replacing F-1's `it.todo` cases for no self-approval.

### F-5: The bank-detail hold

A vendor PI whose bank details differ from the vendor's bank account record holds the payment until Finance and a second approver clear it.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** F-1

Acceptance criteria:

- The bank details on a vendor PI are compared with the vendor's Vendor Bank Account record: Bank Account No., SWIFT Code and IBAN.
- Vendors match on their Business Central number, never on their name.
- Any difference holds the payment, and nobody can pay the vendor while the hold is on.
- Only Finance and a second approver clear the hold: two different people, each with a reason, and neither of them the person who changed the details.
- Bank details are masked by role, with a reason, and the hold shows which field differs without showing the full number to a role that may not see it.
- Every hold, clearance and refusal is audited.
- The bank details are synthetic and obviously fake.
- It is the check behind E2E #4: a vendor PI with changed bank details holds the payment.
- Tests cover matching details, each field differing on its own, a clearance by one person alone, and a clearance by the person who made the change, replacing F-1's `it.todo` cases for the bank-detail hold.

### F-6: A non-owner runtime database role

The API connects as the owner of its tables, and a table owner or a superuser can switch off the audit trail's append-only trigger (ADR 0010). A runtime role that owns nothing closes that door.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** should
- **Estimate:** 3 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 03 (W4)
- **Depends on:** P-10

Acceptance criteria:

- Migrations run as an owner role; the API runs as a second role that can read and write the tables but cannot alter them, disable triggers or truncate.
- The role is created by a migration or the compose set-up, with its password in `.env.example` for laptops and a required secret in production.
- An integration test connects as the runtime role and shows that `ALTER TABLE ... DISABLE TRIGGER` and `TRUNCATE` on the audit table are refused, and that the API still passes its tests.
- The test harness keeps its own owner connection for resets, and says so.

### F-7: Session hardening

Follow-ups to ADR 0012 that nobody needs this week: they make long-lived sessions and production set-up safer.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** could
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 04 (W5)
- **Depends on:** P-10

Acceptance criteria:

- A short grace window for the previous refresh token, so two browser tabs that refresh at the same moment do not end the sign-in as a reuse; the window is audited and off by default in production.
- An absolute lifetime for a sign-in (for example 30 days) on top of the sliding refresh, and a "sign out everywhere" action that revokes every family of one user.
- The sign-in rate limit keeps its counters in Redis, so it holds with more than one API process, and also limits by account as well as by address.
- A one-time command creates the first real administrator in production, where the seeded accounts have no password, and audits it.
- The JWT secret can be rotated with an overlap, so a change does not sign everyone out.

### F-8: Governance base polish

Follow-ups to F-1 that nobody needs this week: they make the matrix easier to use and the controls easier to prove.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** could
- **Estimate:** 3 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 03 (W4)
- **Depends on:** F-1

Acceptance criteria:

- The matrix has a search box and a filter by role or by permission group, and a change can be undone from the page.
- A browser test of E2E #3: a script calls an action endpoint without the right, gets the envelope with a trace id, and the refusal shows in the audit viewer.
- The seed no longer re-adds a permission the owner revoked on purpose (ADR 0012, point 12 and ADR 0024, point 1), with a test.
- The masking sample reads its rule from the matrix screen, so a rule can be shown or hidden for a role without a code change.

### F-9: Audit viewer polish

Follow-ups to F-2 that nobody needs this week: they make the audit log quicker to search and the chain check easier to trust.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** could
- **Estimate:** 3 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 03 (W4)
- **Depends on:** F-2

Acceptance criteria:

- The actor filter is a picker of people by name, not a pasted ID, and the action filter offers the action names that exist.
- A filtered view can be saved by name on the server and shared, not only kept in the address bar.
- The chain check runs in the background for a long trail and shows progress, instead of one request that reads everything.
- A broken chain shows the event it breaks at, with a link to open it and the events around it.
- A browser test: an auditor filters to refusals, opens one, and sees a masked value with its reason.

### P-104: Vendor payments by due date

Finance sees vendor payments by due date, and records only what no hold blocks.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-vendor-payments`
- **Planned for:** Sprint 11 (W12)
- **Depends on:** F-5, P-62, P-101

Acceptance criteria:

- Vendor payments are a list on the template by due date, with due-soon and overdue timers.
- A payment under F-5's hold cannot be recorded until Finance and a second approver clear it.
- No real payment is made: Finance records that it paid, and a change needs a reason.
- Bank details are masked by role with a reason, and every step is audited.
- Check: prompt 003 section 4 and prompt 006 section 6, for every role it touches, at 1440 by 900 and 390 by 844, in light and dark.

## Epic G: Monitoring

Tracing, metrics, clickstream analytics, and the AI cost per document.

### G-1: Area 4 base, monitoring

The monitoring wiring and first screens, with the real dashboards left to Angelyn.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M6 deploy and monitor
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-10, P-11, P-12

Acceptance criteria:

- Wiring: OpenTelemetry for traces and metrics; `/metrics` with prom-client.
- Wiring: an `AnalyticsTracker` class (batching, consent, no PII), a clickstream endpoint and a `ClickstreamEvent` model.
- Screens: AI usage and cost, reading real records; observability and clickstream, on mock data with to-do tests.
- Left to Angelyn: the real dashboards, budgets and alerts, in Weeks 14 to 16 (Sprints 13 to 15).
- Angelyn's review is requested on the pull request once they are a collaborator, and Richie is told when it merges, so he can hand it over.
- Grafana's `otel-lgtm` image as an optional compose profile for traces, metrics and logs, and Sentry for errors in the web app and the API. Both stay off unless configured with an ADR, a pinned version and a traceability row (ADRs 0021 and 0022).

### G-2: Monitoring base polish

Follow-ups to G-1 that nobody needs this week: they close small gaps between the base and a deployed stack.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** could
- **Estimate:** 3 points
- **Requirements:** M2 GRS by design, M6 deploy and monitor
- **Planned for:** Sprint 03 (W4)
- **Depends on:** G-1

Acceptance criteria:

- The production nginx image adds the Sentry origin to its content security policy when a DSN is set at build time, as `vite preview` already does.
- The observability profile's Prometheus scrapes the API's `/metrics` with the bearer token, and the compose file documents how.
- A person can change their analytics choice from a settings page as well as the clickstream tab.
- A browser test records a page view only after consent is given, and sends nothing when Do Not Track is on.

## Epic T: Team stories

The team's own work: owners and reviews, the client, the plan, the assessments and the handover.

### T-1: Owners, backups and reviews

Everyone on the repository and the board, every area with a backup owner, and `CODEOWNERS` filled in.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 2 points
- **Requirements:** M5 team Git workflow
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-2

Acceptance criteria:

- Richie has given each teammate's GitHub username.
- Each teammate is invited with Write access and added to the board.
- Richie has named each area's backup owner.
- `CODEOWNERS` is filled so every path has at least two owners and nobody ever waits on their own approval: each area's paths go to its owner, its backup owner and Richie, and shared files go to Richie and the backup owners.
- Each teammate commits with their GitHub no-reply email (GitHub, Settings, Emails), never a school email.

### T-2: The briefing call with Spectra

The call with the client, with the priority questions sent ahead of it.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 2 points
- **Requirements:** M1 design thinking
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-3

Acceptance criteria:

- The briefing call with Spectra is held in Sprint 2.
- The priority questions in `docs/client/questions-for-client.md` are sent before the call.

### T-3: The project plan

The team's plan for the module.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M5 team Git workflow
- **Planned for:** Sprint 02 (W3)

Acceptance criteria:

- The project plan is done in Sprint 2.

### T-4: The UI prototype across the four areas

The Week 4 prototype of the sales pilot, across all four areas.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M1 design thinking, M4 best practices
- **Planned for:** Sprint 03 (W4)

Acceptance criteria:

- The UI prototype across the four areas is done in Sprint 3.
- It follows the UI rules, and shows only synthetic data, labelled "Synthetic demo data".

### T-5: The proposal deck and presentation

The Week 5 proposal, worth 25%.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M1 design thinking, M2 GRS by design
- **Planned for:** Sprint 04 (W5)
- **Depends on:** P-25

Acceptance criteria:

- The proposal deck and presentation are ready in Sprint 4.
- The release is tagged `v0.1-proposal`, after a feature freeze.

### T-6: Design thinking

The team's design thinking, built on the starting points in `docs/design-thinking/`.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M1 design thinking
- **Planned for:** Sprint 02 (W3) and Sprint 03 (W4)
- **Depends on:** P-3

Acceptance criteria:

- Design thinking is done in Sprints 2 and 3, starting from P-3's `docs/design-thinking/`: the method, personas, journeys, how might we, hypotheses, and success metrics with a measurement protocol.

### T-7: GRS by design

The team's governance, risk and sustainability work, built on `docs/grs/grs-by-design.md`.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design
- **Planned for:** Sprint 03 (W4) and Sprint 04 (W5)
- **Depends on:** P-3

Acceptance criteria:

- GRS by design is done in Sprints 3 and 4, starting from P-3's `docs/grs/grs-by-design.md`: governance, the risk register and sustainability.
- Nothing claims the prototype is PDPA compliant.

### T-8: Preparing for the mock interview

Each member ready to explain their own code at the Week 7 mock job interview, worth 15% each.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M3 AI-assisted coding, M4 best practices
- **Planned for:** Sprint 05 (W6) and Sprint 06 (W7)
- **Depends on:** P-4

Acceptance criteria:

- Done in Sprints 5 and 6, ready for the Week 7 mock job interview.
- Each member can explain their own code, using what their area's guide says the owner explains.

### T-9: The handover

Each owner takes over their area, and the team moves to planning by tasks.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M5 team Git workflow
- **Depends on:** C-1, D-1, F-1, F-2, G-1
- **Condition:** When the base is done.

Acceptance criteria:

- Each owner takes over their area.
- Prompt 007 writes the rest of epics A to G's stories from the owners' planning notes.
- One approving review plus code-owner review is switched on, only on Richie's yes.
- The first sprint is planned by tasks.
