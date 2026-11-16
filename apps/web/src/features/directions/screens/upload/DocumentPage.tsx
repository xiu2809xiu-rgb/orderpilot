import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  demoPageImage,
  type DemoDocument,
  type DemoField,
} from "./demoDocument";
import type { FieldState } from "./useReview";
import "./upload.css";

interface DocumentPageProps {
  document: DemoDocument;
  page: number;
  onPage: (page: number) => void;
  selected: string | null;
  onSelect: (field: DemoField) => void;
  stateOf: (id: string) => FieldState;
}

/** Page 1 of the purchase order, rasterised from the real PDF, with the boxes of its fields. */
export function DocumentPage({
  document: doc,
  page,
  onPage,
  selected,
  onSelect,
  stateOf,
}: DocumentPageProps) {
  const { t } = useTranslation("directions-intake");
  const pages = Array.from({ length: doc.pageCount }, (_, index) => index + 1);
  const onPageFields = doc.fields.filter((field) => field.page === page);
  return (
    <div className="flex flex-col gap-3">
      {pages.length > 1 ? (
        <div
          role="group"
          aria-label={t("review.pages")}
          className="flex items-center gap-1"
        >
          {pages.map((number) => (
            <button
              key={number}
              type="button"
              aria-pressed={number === page}
              onClick={() => {
                onPage(number);
              }}
              className={cn(
                "fs-14 min-h-9 border px-3 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11",
                number === page
                  ? "border-ring bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
              style={{ borderRadius: "var(--radius-control)" }}
            >
              {t("review.pageLabel", { page: number })}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className="dx-page-sheet relative w-full overflow-hidden border border-border bg-white"
        style={{
          aspectRatio: "910 / 1287",
          borderRadius: "var(--radius-control)",
        }}
      >
        <img
          src={demoPageImage(doc, page)}
          alt={t("review.pageImage", { page, number: doc.documentNumber })}
          className="absolute inset-0 size-full select-none"
          draggable={false}
        />
        <div role="group" aria-label={t("review.boxes")}>
          {onPageFields.map((field) => {
            const [x, y, w, h] = field.box;
            const state = stateOf(field.id);
            return (
              <button
                key={field.id}
                type="button"
                tabIndex={-1}
                aria-label={t("review.boxLabel", {
                  label: field.label,
                  value: (state.edited ?? field.text).replaceAll("\n", ", "),
                })}
                data-selected={selected === field.id}
                data-uncertain={field.uncertain && !state.confirmed}
                data-confirmed={field.uncertain && state.confirmed}
                onClick={() => {
                  onSelect(field);
                }}
                className="dx-box absolute"
                style={{
                  left: `${String(x * 100)}%`,
                  top: `${String(y * 100)}%`,
                  width: `${String(w * 100)}%`,
                  height: `${String(h * 100)}%`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
