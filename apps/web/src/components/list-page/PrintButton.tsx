import { Printer } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "@/components/common";
import { toast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";
import { PrintView } from "./PrintView";

interface PrintButtonProps<Row> {
  label: string;
  title: string;
  filters: readonly string[];
  columns: readonly DataTableColumn<Row>[];
  /** The rows on screen. */
  rows: readonly Row[];
  /** Every row the filter shows. Without it the print holds the rows on screen. */
  loadRows?: (() => Promise<readonly Row[]>) | undefined;
}

/** Print: fetches every row the filter shows, then opens the print view. */
export function PrintButton<Row>({
  label,
  title,
  filters,
  columns,
  rows,
  loadRows,
}: PrintButtonProps<Row>) {
  const { t } = useTranslation("list-page");
  const [state, setState] = useState<
    | { step: "idle" }
    | { step: "loading" }
    | { step: "ready"; rows: readonly Row[] }
  >({ step: "idle" });
  const done = useCallback(() => {
    setState({ step: "idle" });
  }, []);

  async function start() {
    setState({ step: "loading" });
    try {
      setState({ step: "ready", rows: loadRows ? await loadRows() : rows });
    } catch {
      setState({ step: "idle" });
      toast.failed(t("print.failed"));
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="pointer-coarse:h-11"
        aria-disabled={state.step === "loading" || undefined}
        onClick={() => {
          if (state.step === "idle") void start();
        }}
      >
        <Printer aria-hidden="true" />
        {state.step === "loading" ? t("print.preparing") : label}
      </Button>
      {state.step === "ready" ? (
        <PrintView
          title={title}
          filters={filters}
          columns={columns}
          rows={state.rows}
          onDone={done}
        />
      ) : null}
    </>
  );
}
