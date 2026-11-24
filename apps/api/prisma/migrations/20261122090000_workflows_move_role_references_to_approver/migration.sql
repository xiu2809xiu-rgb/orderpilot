-- Step 3 of the role cut (#293, ADR 0058): area 2 stops naming Management and the
-- auditor. Wherever the two tables below store one of them as a target, the
-- management approver (APPROVER) takes its place. Data only: no table, column or
-- enum value changes. Safe to run twice (a moved row no longer matches) and on an
-- empty database (nothing matches).
--
-- AuditEvent and ClickstreamEvent are never touched here: an audit event keeps the
-- role its actor held, because its hash covers it, and a click-stream row keeps
-- the role it was recorded with.
--
-- WorkflowTask.assigneeRole and CheckException.fixBy are left exactly as they
-- are. Tasks come from the roles that have an inbox and an exception is fixed by
-- a team that works, so no row should name Management or the auditor. If one
-- ever does, moving it here would hand the work to the approvers in silence, and
-- an approver can complete a task in its own inbox. The CHECK constraints that
-- step 6 adds will refuse such a row instead. CheckException is area 3's table,
-- which this migration never writes.
--
-- The one exception to the move is the SPR approval (Spectra's 24-hour rule): it
-- keeps escalating to Management until step 6 makes that account an approver, so
-- its SLA row and the escalations already sent for an SPR approval task stay as
-- they are.

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
