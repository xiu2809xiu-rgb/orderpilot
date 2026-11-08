import { useTranslation } from "react-i18next";
import type { DocumentRecordState } from "@/components/document-form";
import { useMasterDataItems } from "@/lib/api/generated/endpoints/master-data/master-data";
import { hasPermission, useSessionStore } from "@/stores/session";
import { OrderDocument } from "./OrderDocument";

/**
 * Starts an order. A role that may not start one sees why and the page makes no
 * call; the server refuses the write all the same. Whether the role sees prices
 * is read from the server's own answer for an item, so the web holds no copy of
 * who may see them.
 */
export default function NewOrderPage() {
  const { t } = useTranslation("orders");
  const allowed = hasPermission(
    useSessionStore((state) => state.session),
    "orders.create",
  );
  const items = useMasterDataItems(
    { pageSize: 1 },
    { query: { enabled: allowed } },
  );
  let state: DocumentRecordState | undefined;
  if (!allowed) state = { kind: "denied", description: t("form.denied") };
  else if (items.isPending) state = { kind: "loading" };
  else if (items.isError) {
    state = {
      kind: "error",
      error: items.error,
      onRetry: () => void items.refetch(),
    };
  }
  return (
    <OrderDocument
      key={state?.kind ?? "ready"}
      record={null}
      {...(state ? { state } : {})}
      priceMasked={items.data?.data[0]?.unitPrice.masked ?? false}
      readOnly={null}
      onReload={() => undefined}
    />
  );
}
