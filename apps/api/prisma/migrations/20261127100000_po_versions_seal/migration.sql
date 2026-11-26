-- PO versions, sealed (ADR 0074 decision 3). The first migration refused to
-- UPDATE or DELETE a copy, but a later INSERT could still add a line under an
-- old copy, and an order could be inserted at a number above 1 with no copies.
-- This one closes both.

-- A copy holds the number of lines it was written with. Prisma declares the
-- column; the CHECK is written by hand, as the first migration's are. The
-- column is added without NOT NULL first so that a database that already holds
-- copies (a development one) is filled from its own lines, with the row
-- trigger off for that one statement and on again straight after.
ALTER TABLE "SalesOrderPoVersion" ADD COLUMN "lineCount" INTEGER;
ALTER TABLE "SalesOrderPoVersion" DISABLE TRIGGER "SalesOrderPoVersion_refuse_update_delete";
UPDATE "SalesOrderPoVersion" AS v
  SET "lineCount" = (SELECT count(*) FROM "SalesOrderPoVersionLine" AS l WHERE l."versionId" = v."id");
ALTER TABLE "SalesOrderPoVersion" ENABLE TRIGGER "SalesOrderPoVersion_refuse_update_delete";
ALTER TABLE "SalesOrderPoVersion" ALTER COLUMN "lineCount" SET NOT NULL;
ALTER TABLE "SalesOrderPoVersion" ADD CONSTRAINT "SalesOrderPoVersion_lineCount_check" CHECK ("lineCount" >= 1);

-- At commit, a copy's lines are exactly as many as its lineCount. A line
-- inserted under an old copy in a later transaction makes the count one too
-- many, and a copy written without all its lines one too few. The message
-- holds no price.
CREATE FUNCTION "po_version_check_lines"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  copy_id uuid;
  expected integer;
  actual integer;
BEGIN
  IF TG_TABLE_NAME = 'SalesOrderPoVersion' THEN
    copy_id := NEW."id";
  ELSE
    copy_id := NEW."versionId";
  END IF;
  SELECT "lineCount" INTO expected FROM "SalesOrderPoVersion" WHERE "id" = copy_id;
  IF expected IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT count(*) INTO actual FROM "SalesOrderPoVersionLine" WHERE "versionId" = copy_id;
  IF actual <> expected THEN
    RAISE EXCEPTION 'PO version copy % is sealed at % lines but holds %', copy_id, expected, actual
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "SalesOrderPoVersion_match_lines"
  AFTER INSERT ON "SalesOrderPoVersion"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "po_version_check_lines"();

CREATE CONSTRAINT TRIGGER "SalesOrderPoVersionLine_match_copy"
  AFTER INSERT ON "SalesOrderPoVersionLine"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "po_version_check_lines"();

-- The head's own check also runs when an order is inserted, so a row inserted
-- at PO version 3 with no copies fails at commit instead of making every read
-- of it fail later.
DROP TRIGGER "SalesOrder_po_versions_match" ON "SalesOrder";
CREATE CONSTRAINT TRIGGER "SalesOrder_po_versions_match"
  AFTER INSERT OR UPDATE OF "poVersionNo" ON "SalesOrder"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "po_version_check_copies"();
