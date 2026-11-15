# Spectra on the real site: pictures from the Docker build

Synthetic demo data throughout. 49 pictures.

## When

15 November 2026, from commit `40bf8be` of `feat/platform-direction-rollout` (P-106 and P-107, issues #244
and #245).

## How

- A Docker build of the branch: the `migrate`, `api` and `web` images were built from the commit and run in the
  compose project `orderpilot-p106`, beside that project's own PostgreSQL, Redis, MinIO and Mailpit.
- The site is the production web image (static build behind its real security headers) at
  `http://localhost:48087`, not the dev server.
- Demo mode: every role signed in through `/api/v1/auth/demo-login` (the nine demo roles). The sign-in page was
  taken signed out.
- The analytics consent was answered beforehand (`op.analytics.consent` set to `denied` and the card marked as
  shown, in an init script), so the consent card is not in the pictures.
- The theme was set through `op-theme`, and the browser asked for reduced motion, so the pictures are still.
- Chromium through Playwright, taken after the network was idle plus 1.5 s. The 1440 by 900 pictures are JPEG at
  quality 85 (as PNG the folder was 22 MB, over the 20 MB limit). The 390 by 844 pictures are PNG, taken in
  light with touch emulation.
- The whole end-to-end suite ran against the same site just before: 59 passed.

## The pictures

| Page                  | Role            | Scheme | Size              | File                                                                             |
| --------------------- | --------------- | ------ | ----------------- | -------------------------------------------------------------------------------- |
| Home                  | System admin    | Dark   | 1440 by 900       | [home-system-admin-dark-1440.jpg](home-system-admin-dark-1440.jpg)               |
| Home                  | System admin    | Light  | 1440 by 900       | [home-system-admin-light-1440.jpg](home-system-admin-light-1440.jpg)             |
| Home                  | Product manager | Dark   | 1440 by 900       | [home-product-manager-dark-1440.jpg](home-product-manager-dark-1440.jpg)         |
| Home                  | Product manager | Light  | 1440 by 900       | [home-product-manager-light-1440.jpg](home-product-manager-light-1440.jpg)       |
| Home                  | Approver        | Dark   | 1440 by 900       | [home-approver-dark-1440.jpg](home-approver-dark-1440.jpg)                       |
| Home                  | Approver        | Light  | 1440 by 900       | [home-approver-light-1440.jpg](home-approver-light-1440.jpg)                     |
| Home                  | Support         | Dark   | 1440 by 900       | [home-support-dark-1440.jpg](home-support-dark-1440.jpg)                         |
| Home                  | Support         | Light  | 1440 by 900       | [home-support-light-1440.jpg](home-support-light-1440.jpg)                       |
| Home                  | Warehouse       | Dark   | 1440 by 900       | [home-warehouse-dark-1440.jpg](home-warehouse-dark-1440.jpg)                     |
| Home                  | Warehouse       | Light  | 1440 by 900       | [home-warehouse-light-1440.jpg](home-warehouse-light-1440.jpg)                   |
| Home                  | Finance         | Dark   | 1440 by 900       | [home-finance-dark-1440.jpg](home-finance-dark-1440.jpg)                         |
| Home                  | Finance         | Light  | 1440 by 900       | [home-finance-light-1440.jpg](home-finance-light-1440.jpg)                       |
| Home                  | Logistics       | Dark   | 1440 by 900       | [home-logistics-dark-1440.jpg](home-logistics-dark-1440.jpg)                     |
| Home                  | Logistics       | Light  | 1440 by 900       | [home-logistics-light-1440.jpg](home-logistics-light-1440.jpg)                   |
| Home                  | Management      | Dark   | 1440 by 900       | [home-management-dark-1440.jpg](home-management-dark-1440.jpg)                   |
| Home                  | Management      | Light  | 1440 by 900       | [home-management-light-1440.jpg](home-management-light-1440.jpg)                 |
| Home                  | Auditor         | Dark   | 1440 by 900       | [home-auditor-dark-1440.jpg](home-auditor-dark-1440.jpg)                         |
| Home                  | Auditor         | Light  | 1440 by 900       | [home-auditor-light-1440.jpg](home-auditor-light-1440.jpg)                       |
| Sign-in page          | Signed out      | Dark   | 1440 by 900       | [login-signed-out-dark-1440.jpg](login-signed-out-dark-1440.jpg)                 |
| Sign-in page          | Signed out      | Light  | 1440 by 900       | [login-signed-out-light-1440.jpg](login-signed-out-light-1440.jpg)               |
| Orders list           | Support         | Dark   | 1440 by 900       | [orders-support-dark-1440.jpg](orders-support-dark-1440.jpg)                     |
| Orders list           | Support         | Light  | 1440 by 900       | [orders-support-light-1440.jpg](orders-support-light-1440.jpg)                   |
| Order SO-0024         | Support         | Dark   | 1440 by 900       | [order-SO-0024-support-dark-1440.jpg](order-SO-0024-support-dark-1440.jpg)       |
| Order SO-0024         | Support         | Light  | 1440 by 900       | [order-SO-0024-support-light-1440.jpg](order-SO-0024-support-light-1440.jpg)     |
| New order             | Support         | Dark   | 1440 by 900       | [orders-new-support-dark-1440.jpg](orders-new-support-dark-1440.jpg)             |
| New order             | Support         | Light  | 1440 by 900       | [orders-new-support-light-1440.jpg](orders-new-support-light-1440.jpg)           |
| Customers list        | Support         | Dark   | 1440 by 900       | [customers-support-dark-1440.jpg](customers-support-dark-1440.jpg)               |
| Customers list        | Support         | Light  | 1440 by 900       | [customers-support-light-1440.jpg](customers-support-light-1440.jpg)             |
| Customer C-0001       | Support         | Dark   | 1440 by 900       | [customer-C-0001-support-dark-1440.jpg](customer-C-0001-support-dark-1440.jpg)   |
| Customer C-0001       | Support         | Light  | 1440 by 900       | [customer-C-0001-support-light-1440.jpg](customer-C-0001-support-light-1440.jpg) |
| My tasks (/workflows) | Support         | Dark   | 1440 by 900       | [workflows-support-dark-1440.jpg](workflows-support-dark-1440.jpg)               |
| My tasks (/workflows) | Support         | Light  | 1440 by 900       | [workflows-support-light-1440.jpg](workflows-support-light-1440.jpg)             |
| Exceptions            | Support         | Dark   | 1440 by 900       | [exceptions-support-dark-1440.jpg](exceptions-support-dark-1440.jpg)             |
| Exceptions            | Support         | Light  | 1440 by 900       | [exceptions-support-light-1440.jpg](exceptions-support-light-1440.jpg)           |
| Order tracker         | Warehouse       | Dark   | 1440 by 900       | [order-tracker-warehouse-dark-1440.jpg](order-tracker-warehouse-dark-1440.jpg)   |
| Order tracker         | Warehouse       | Light  | 1440 by 900       | [order-tracker-warehouse-light-1440.jpg](order-tracker-warehouse-light-1440.jpg) |
| Insights (KPIs)       | Management      | Dark   | 1440 by 900       | [insights-management-dark-1440.jpg](insights-management-dark-1440.jpg)           |
| Insights (KPIs)       | Management      | Light  | 1440 by 900       | [insights-management-light-1440.jpg](insights-management-light-1440.jpg)         |
| Governance            | System admin    | Dark   | 1440 by 900       | [governance-system-admin-dark-1440.jpg](governance-system-admin-dark-1440.jpg)   |
| Governance            | System admin    | Light  | 1440 by 900       | [governance-system-admin-light-1440.jpg](governance-system-admin-light-1440.jpg) |
| Audit log             | System admin    | Dark   | 1440 by 900       | [audit-system-admin-dark-1440.jpg](audit-system-admin-dark-1440.jpg)             |
| Audit log             | System admin    | Light  | 1440 by 900       | [audit-system-admin-light-1440.jpg](audit-system-admin-light-1440.jpg)           |
| Settings              | Support         | Dark   | 1440 by 900       | [settings-support-dark-1440.jpg](settings-support-dark-1440.jpg)                 |
| Settings              | Support         | Light  | 1440 by 900       | [settings-support-light-1440.jpg](settings-support-light-1440.jpg)               |
| Home                  | Support         | Light  | 390 by 844, touch | [home-support-light-390.png](home-support-light-390.png)                         |
| Home                  | Warehouse       | Light  | 390 by 844, touch | [home-warehouse-light-390.png](home-warehouse-light-390.png)                     |
| Sign-in page          | Signed out      | Light  | 390 by 844, touch | [login-signed-out-light-390.png](login-signed-out-light-390.png)                 |
| Orders list           | Support         | Light  | 390 by 844, touch | [orders-support-light-390.png](orders-support-light-390.png)                     |
| Order SO-0024         | Support         | Light  | 390 by 844, touch | [order-SO-0024-support-light-390.png](order-SO-0024-support-light-390.png)       |
