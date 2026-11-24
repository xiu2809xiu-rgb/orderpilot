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

-- Who is told when a task is overdue is a control setting, and the same change
-- through the route writes a workflows.sla.changed event. A migration cannot write
-- one, so each row it moves leaves a marker first, with the old and the new role,
-- and the seed records the event (ADR 0058, decision 8). A fresh database has no
-- rows here yet, so it leaves none. The notices below are data, not a setting, and
-- leave no marker.
INSERT INTO "MigrationMarker" ("migration", "action", "entityType", "entityId", "changes")
SELECT '20261122090000_workflows_move_role_references_to_approver',
       'workflows.sla.changed',
       'WorkflowTaskSla',
       "taskKind",
       jsonb_build_object(
         'before', jsonb_build_object('escalateToRole', "escalateToRole"::text),
         'after', jsonb_build_object('escalateToRole', 'APPROVER')
       )
FROM "WorkflowTaskSla"
WHERE "escalateToRole" IN ('MANAGEMENT', 'AUDITOR')
  AND "taskKind" <> 'APPROVE_SPR'
ON CONFLICT DO NOTHING;

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
