import { Info, ScanText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/parts/Section";
import { SAMPLE_SHOWN, sampleFor, type PreviewName } from "./demoDocument";
import { DropZone } from "./DropZone";
import { FileRow, type SampleNote } from "./FileRow";
import { RefusedNotes } from "./RefusedNotes";
import type { useUploads } from "./useUploads";

/**
 * The first step: the drop zone with its limits, a row for every file that was
 * taken with its progress, a message for every file that was not, and the one
 * primary button, Read with Spark.
 * The preview reads a sample, not the file: each row says before anything
 * starts whether its file has a sample, and the button reads the first file
 * that has one. With no file to hand, the demo purchase order starts the same
 * reading. The line that nothing is saved stands beside the button.
 */
export function AddStage({
  uploads,
  onRead,
}: {
  uploads: ReturnType<typeof useUploads>;
  /** The sample Spark will read. */
  onRead: (sample: PreviewName) => void;
}) {
  const { t } = useTranslation("directions-intake");
  const { rows, refused, add, remove, dismiss } = uploads;
  const list = useRef<HTMLUListElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  // Where focus goes once a removed row is gone: its successor in the list.
  const [after, setAfter] = useState<{ index: number } | null>(null);
  useEffect(() => {
    if (!after) return;
    const buttons =
      list.current?.querySelectorAll<HTMLElement>("[data-remove]");
    (buttons?.[after.index] ?? zone.current?.querySelector("button"))?.focus();
    setAfter(null);
  }, [after]);

  const checking = rows.some((row) => row.status === "reading");
  // The button stays off while any file is being checked, so the first sample
  // in the list is also the first one that is ready.
  const sampled = rows.flatMap((row) => {
    const sample = sampleFor(row.name);
    return sample ? [{ id: row.id, sample }] : [];
  });
  const first = sampled[0];
  const ready = rows.some((row) => row.status === "ready");
  const note = (id: number, name: string): SampleNote => {
    const sample = sampleFor(name);
    if (!sample) return { kind: "none" };
    return id === first?.id
      ? { kind: "sample", document: SAMPLE_SHOWN[sample] }
      : { kind: "later" };
  };
  const hint = checking
    ? t("startChecking")
    : ready && !first
      ? t("startNoSample")
      : first
        ? null
        : t("startNeeds");

  return (
    <Section title={t("add.title")} intro={t("add.intro")} work>
      <div className="flex flex-col gap-4">
        <div ref={zone} data-dropzone="">
          <DropZone
            onFiles={add}
            onDemo={() => {
              onRead("po-boxed-so-0102");
            }}
          />
        </div>
        <RefusedNotes
          notes={refused}
          onDismiss={(id) => {
            dismiss(id);
            // The message that had focus is gone: the drop zone is the next place.
            zone.current?.querySelector("button")?.focus();
          }}
        />
        {rows.length > 0 ? (
          <ul
            ref={list}
            aria-label={t("files.label")}
            className="flex flex-col gap-2"
          >
            {rows.map((row) => (
              <FileRow
                key={row.id}
                row={row}
                sample={note(row.id, row.name)}
                onRemove={(id) => {
                  setAfter({ index: rows.findIndex((item) => item.id === id) });
                  remove(id);
                }}
              />
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="fs-14 flex items-start gap-2 text-muted-foreground">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {t("saves")}
            </p>
            {hint ? (
              <p className="fs-14 text-muted-foreground" role="status">
                {hint}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            disabled={checking || !first}
            onClick={() => {
              if (first) onRead(first.sample);
            }}
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
