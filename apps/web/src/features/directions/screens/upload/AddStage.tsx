import { ScanText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/parts/Section";
import { DropZone } from "./DropZone";
import { FileRow } from "./FileRow";
import type { useUploads } from "./useUploads";

/**
 * The first step: the drop zone with its limits, a row for every file with
 * its progress or its refusal, and the one primary button, Read with Spark,
 * which opens once a file has been checked. With no file to hand, the demo
 * purchase order starts the same reading.
 */
export function AddStage({
  uploads,
  onRead,
}: {
  uploads: ReturnType<typeof useUploads>;
  onRead: () => void;
}) {
  const { t } = useTranslation("directions-intake");
  const { rows, add, remove, ready } = uploads;
  return (
    <Section title={t("add.title")} intro={t("add.intro")} work>
      <div className="flex flex-col gap-4">
        <DropZone onFiles={add} onDemo={onRead} />
        {rows.length > 0 ? (
          <ul aria-label={t("files.label")} className="flex flex-col gap-2">
            {rows.map((row) => (
              <FileRow key={row.id} row={row} onRemove={remove} />
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {ready === 0 ? (
            <p className="fs-14 text-muted-foreground" role="status">
              {t("startNeeds")}
            </p>
          ) : null}
          <Button
            type="button"
            disabled={ready === 0}
            onClick={onRead}
            className="pointer-coarse:h-11"
          >
            <ScanText aria-hidden="true" />
            {t("start")}
          </Button>
        </div>
      </div>
    </Section>
  );
}
