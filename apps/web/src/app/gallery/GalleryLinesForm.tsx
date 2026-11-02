import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common";
import {
  FormActions,
  FormShell,
  SaveButton,
  useDraft,
  useFormSave,
  useSaveShortcut,
  useZodForm,
} from "@/components/form";
import {
  LinesGrid,
  lineDraftOptions,
  type LineColumn,
  type PriceMask,
  type ServerTotals,
} from "@/components/lines-grid";
import { Button } from "@/components/ui/button";
import { GalleryLinesBar } from "./GalleryLinesBar";
import {
  fakeLinesSave,
  makeLinesSchema,
  manyLines,
  searchGalleryItems,
  startingLines,
  type LinesAnswer,
  type LinesViewer,
  type LinesInput,
  type LinesOutput,
} from "./linesDemo";

/**
 * The lines grid as Support uses it: prices on, stock beside every line. The
 * viewer switch shows the same grid for a role that may not see prices, and the
 * save is faked so each answer of the server can be seen.
 */
export function GalleryLinesForm({
  viewer,
  onViewer,
}: {
  viewer: LinesViewer;
  onViewer: (viewer: LinesViewer) => void;
}) {
  const { t } = useTranslation("gallery");
  const [readOnly, setReadOnly] = useState(false);
  const [answer, setAnswer] = useState<LinesAnswer>("saves");
  const [serverTotals, setServerTotals] = useState<ServerTotals>();
  const answerNow = useRef(answer);
  useEffect(() => {
    answerNow.current = answer;
  }, [answer]);
  const priceMask = useMemo<PriceMask | null>(
    () =>
      viewer === "warehouse"
        ? { reason: "price", visibleTo: t("lines.visibleTo") }
        : null,
    [viewer, t],
  );
  const schema = useMemo(() => makeLinesSchema(t), [t]);
  const form = useZodForm<LinesInput, LinesOutput>({
    schema,
    defaultValues: { lines: startingLines(viewer === "support") },
  });
  const draft = useDraft(`gallery.lines-grid.${viewer}`, form, {
    ...lineDraftOptions("lines", priceMask !== null),
  });
  const save = useFormSave(form, {
    draft,
    onSave: (values) => fakeLinesSave(answerNow.current, values, t),
    onSaved: (totals) => {
      setServerTotals(totals);
      toast.done(t("lines.saved"));
    },
  });
  useSaveShortcut(form, save, { allowClean: true });
  const columns = useMemo<LineColumn[]>(
    () => [
      { kind: "lineNo", header: t("lines.columns.lineNo") },
      { kind: "item", header: t("lines.columns.item") },
      { kind: "description", header: t("lines.columns.description") },
      { kind: "quantity", header: t("lines.columns.quantity") },
      { kind: "unitPrice", header: t("lines.columns.unitPrice") },
      { kind: "amount", header: t("lines.columns.amount") },
      { kind: "availability", header: t("lines.columns.availability") },
      { kind: "remove", header: t("lines.columns.remove") },
    ],
    [t],
  );

  return (
    <div className="space-y-s2">
      <GalleryLinesBar
        viewer={viewer}
        onViewer={onViewer}
        readOnly={readOnly}
        onReadOnly={setReadOnly}
        answer={answer}
        onAnswer={setAnswer}
        onMany={() => {
          form.reset({ lines: manyLines(viewer === "support") });
        }}
        onFew={() => {
          form.reset({ lines: startingLines(viewer === "support") });
        }}
      />
      <FormShell form={form} draft={draft} aria-label={t("lines.formLabel")}>
        <LinesGrid
          label={t("lines.tableLabel")}
          columns={columns}
          searchItems={searchGalleryItems}
          readOnly={readOnly}
          priceMask={priceMask}
          serverTotals={serverTotals}
          shortfallAction={(short) => (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="pointer-coarse:h-11"
              onClick={() => {
                toast.done(t("lines.sprDone", { item: short.itemNo }));
              }}
            >
              {t("lines.raiseSpr")}
            </Button>
          )}
        />
        {readOnly ? null : (
          <FormActions note={t("lines.note")}>
            <SaveButton
              form={form}
              onSave={save}
              variant="outline"
              allowClean
            />
          </FormActions>
        )}
      </FormShell>
    </div>
  );
}
