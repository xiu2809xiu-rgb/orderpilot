-- Step 3 of the role cut (#293, ADR 0058): area 2 stops naming Management and the
-- auditor. Wherever the four tables below store one of them as a target, the
-- management approver (APPROVER) takes its place. Data only: no table, column or
-- enum value changes. Safe to run twice (a moved row no longer matches) and on an
-- empty database (nothing matches).
--
-- AuditEvent and ClickstreamEvent are never touched here: an audit event keeps the
-- role its actor held, because its hash covers it, and a click-stream row keeps
-- the role it was recorded with.

-- The one exception is the SPR approval (Spectra's 24-hour rule): it keeps
-- escalating to Management until step 6 makes that account an approver, so its
-- SLA row and the escalations already sent for an SPR approval task stay as they
-- are.

-- Who is told when a task is overdue. The default was MANAGEMENT.
UPDATE "WorkflowTaskSla"
SET "escalateToRole" = 'APPROVER'
WHERE "escalateToRole" IN ('MANAGEMENT', 'AUDITOR')
  AND "taskKind" <> 'APPROVE_SPR';

-- Reminders and escalations already addressed to a role, except those sent for
-- an SPR approval task.
UPDATE "WorkflowNotification"
SET "recipientRole" = 'APPROVER'
WHERE "recipientRole" IN ('MANAGEMENT', 'AUDITOR')
  AND ("taskId" IS NULL
    OR "taskId" NOT IN (SELECT "id" FROM "WorkflowTask" WHERE "kind" = 'APPROVE_SPR'));

-- A safety net: tasks come from the roles that have an inbox, so none should match.
UPDATE "WorkflowTask"
SET "assigneeRole" = 'APPROVER'
WHERE "assigneeRole" IN ('MANAGEMENT', 'AUDITOR');

-- A safety net as well: an exception is fixed by a team that works, so none should match.
UPDATE "CheckException"
SET "fixBy" = 'APPROVER'
WHERE "fixBy" IN ('MANAGEMENT', 'AUDITOR');
