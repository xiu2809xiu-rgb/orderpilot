import type { SalesOrderDetail } from "@orderpilot/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  DocumentForm,
  type DocumentRecordState,
} from "@/components/document-form";
import { useZodForm } from "@/components/form";
import {
  LinesFooter,
  LinesGrid,
  lineDraftOptions,
  type LineColumn,
  type LineTotals,
  type PriceMask,
} from "@/components/lines-grid";
import { CAPTURE_FAMILY } from "./captureFamily";
import { LineAvailability } from "./LineAvailability";
import { OrderHeaderFields } from "./OrderHeaderFields";
import { OrderNotices, type ReadOnlyReason } from "./OrderNotices";
import {
  makeOrderFormSchema,
  type OrderFormInput,
  type OrderFormOutput,
} from "./orderFormSchema";
import { blankOrder, fromDetail } from "./orderFormValues";
import { searchItems } from "./orderSearches";
import { useOrderActions } from "./useOrderActions";
import { useOrderSave } from "./useOrderSave";

const COLUMN_KINDS = [
  "lineNo",
  "item",
  "description",
  "quantity",
  "unitPrice",
  "amount",
  "availability",
  "remove",
] as const;

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

interface OrderDocumentProps {
  /** Null while the order is new. */
  record: SalesOrderDetail | null;
  /** While the record is not in hand: the template draws it instead of the form. */
  state?: DocumentRecordState;
  /** Read from the server's own masking, so the web copies no rule of it. */
  priceMasked: boolean;
  /** Why this page cannot be edited, or null when it can. */
  readOnly: ReadOnlyReason | null;
  onReload: () => void;
}

/**
 * The sales order as a document: header, lines, footer and tabs, for a new
 * order and for a saved one. The form starts from the record and never
 * from a later one: the page gives this component a new key when the record
 * moves on, so typing and focus survive the form's own saves.
 */
export function OrderDocument({
  record,
  state,
  priceMasked,
  readOnly,
  onReload,
}: OrderDocumentProps) {
  const { t } = useTranslation("orders");
  const orderNo = record?.orderNo ?? null;
  const schema = useMemo(
    () => makeOrderFormSchema(t, priceMasked),
    [t, priceMasked],
  );
  const form = useZodForm<OrderFormInput, OrderFormOutput>({
    schema,
    defaultValues: record ? fromDetail(record) : blankOrder(today()),
  });
  const save = useOrderSave({ form, orderNo, priceMasked });
  const actions = useOrderActions({
    form,
    orderNo,
    editable: readOnly === null,
  });
  const columns = useMemo<LineColumn[]>(
    () =>
      COLUMN_KINDS.map((kind) => ({
        kind,
        header: t(`form.lines.columns.${kind}`),
      })),
    [t],
  );
  const priceMask = useMemo<PriceMask | null>(
    () =>
      priceMasked
        ? { reason: "price", visibleTo: t("form.lines.visibleTo") }
        : null,
    [priceMasked, t],
  );
  // A poll writes the stock and the unit into the form, and neither is the
  // person's to keep: they are left out so a poll never writes a draft.
  const draftOptions = useMemo(() => {
    const base = lineDraftOptions("lines", priceMasked);
    return { ...base, exclude: [...(base.exclude ?? []), "lines.*.unit"] };
  }, [priceMasked]);
  const captureState = record?.captureState ?? null;
  // A read-only page has a key of its own, or a draft typed against the
  // editable page would come back over a void order.
  const draftKey =
    orderNo === null
      ? "order.new"
      : readOnly === null
        ? `order.${orderNo}`
        : `order.${orderNo}.read`;

  return (
    <DocumentForm
      formId="order-form"
      form={form}
      title={
        orderNo ? t("form.title", { number: orderNo }) : t("form.newTitle")
      }
      number={orderNo ?? ""}
      demo="synthetic"
      formLabel={t("form.formLabel")}
      {...(readOnly === null
        ? {
            description: t(
              orderNo ? "form.draftDescription" : "form.newDescription",
            ),
          }
        : {})}
      notices={
        <OrderNotices
          notice={save.notice}
          readOnly={readOnly}
          onReload={() => {
            // Drops the typed draft first, or the reload would bring it back.
            form.reset();
            onReload();
          }}
        />
      }
      header={<OrderHeaderFields form={form} readOnly={readOnly !== null} />}
      lines={
        <>
          <LinesGrid
            label={t("form.lines.tableLabel")}
            columns={columns}
            searchItems={searchItems}
            readOnly={readOnly !== null}
            priceMask={priceMask}
            footer={(totals: LineTotals) => (
              <div className="space-y-s1">
                <LinesFooter totals={totals} />
                <p className="measure text-xs text-muted-foreground">
                  {t("form.lines.hint")}
                </p>
              </div>
            )}
          />
          <LineAvailability form={form} paused={captureState === "void"} />
        </>
      }
      status={{
        family: captureState ? CAPTURE_FAMILY[captureState] : "draft",
        label: captureState
          ? t(`captureStates.${captureState}`)
          : t(record ? "sampleTag" : "form.statusNew"),
      }}
      actions={actions}
      draftKey={draftKey}
      draftOptions={draftOptions}
      onSave={save.onSave}
      onSaved={save.onSaved}
      serverPaths={save.serverPaths}
      nextValues={() => blankOrder(today())}
      {...(readOnly
        ? { saveBlocked: t(`form.notices.readOnly.${readOnly}`) }
        : {})}
      {...(state ? { state } : {})}
      tabs={{
        timeline: { content: null, emptyText: t("form.tabsEmpty") },
        checks: { content: null, emptyText: t("form.tabsEmpty") },
        documents: { content: null, emptyText: t("form.tabsEmpty") },
        ...(orderNo
          ? { log: { entityType: "Order" as const, entityId: orderNo } }
          : {}),
      }}
    />
  );
}
