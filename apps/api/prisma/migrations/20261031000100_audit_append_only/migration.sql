-- The audit trail is append-only. A trigger refuses to change or remove an
-- event, so no code path (and no mistaken query) can rewrite history. The hash
-- chain (audit.chain.ts) then shows any tampering made by other means.

CREATE FUNCTION "audit_event_refuse_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "AuditEvent_refuse_update_delete"
  BEFORE UPDATE OR DELETE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION "audit_event_refuse_change"();

CREATE TRIGGER "AuditEvent_refuse_truncate"
  BEFORE TRUNCATE ON "AuditEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_event_refuse_change"();
