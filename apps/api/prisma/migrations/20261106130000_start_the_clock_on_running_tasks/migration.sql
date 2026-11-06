-- A task's clock used to mean nothing. Tasks on orders the state machine runs still
-- hold the demo's dated fixtures, so without this the first sweep would mark every
-- one of them as long overdue. Their clock starts now, as it does on a fresh seed.
UPDATE "WorkflowTask" AS task
SET "createdAt" = now(),
    "dueAt" = now() + interval '24 hours'
FROM "WorkflowInstance" AS instance
WHERE task."instanceId" = instance."id"
  AND instance."facts" IS NOT NULL
  AND task."kind" = 'APPROVE_SPR'
  AND task."status" = 'OPEN';
