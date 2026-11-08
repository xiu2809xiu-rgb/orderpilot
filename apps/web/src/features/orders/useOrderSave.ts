import { DUPLICATE_ORDER_PATH, existingOrderOf } from "@orderpilot/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "@/components/common";
import type { PathMap } from "@/components/form";
import {
  ordersCreate,
  ordersUpdate,
} from "@/lib/api/generated/endpoints/orders/orders";
import { ApiError } from "@/lib/api/errors";
import type { OrderNotice } from "./OrderNotices";
import type { OrderFormOutput } from "./orderFormSchema";
import {
  setOrderVersion,
  toCreateBody,
  toPatchBody,
  type OrderForm,
} from "./orderFormValues";

type Answer = Awaited<ReturnType<typeof ordersCreate>>;

/** The server's names for what the form calls something else. */
const SERVER_PATHS: PathMap = {
  customerNo: "customer",
  "lines.*.itemNo": "lines.*.item",
};

/**
 * The order form's two writes, the answers it gives to a 409, and the notice
 * that goes with each.
 *
 * A repeated PO number is a 409 that names the existing order. The name goes
 * to the notice, and the error that reaches the form no longer carries it, or
 * the form would draw it as a bullet of its own with the bare number. Any other
 * 409 is a draft that moved on: the server's words stay on the form and the
 * notice offers Reload.
 */
export function useOrderSave(options: {
  form: OrderForm;
  /** Null while the order is new. */
  orderNo: string | null;
  priceMasked: boolean;
}) {
  const { form, orderNo, priceMasked } = options;
  const { t } = useTranslation("orders");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<OrderNotice | null>(null);
  const customer = useWatch({ control: form.control, name: "customer" });
  const po = useWatch({ control: form.control, name: "externalDocumentNo" });

  const onSave = useCallback(
    async (values: OrderFormOutput): Promise<Answer> => {
      setNotice(null);
      try {
        return orderNo === null
          ? await ordersCreate(toCreateBody(values, priceMasked))
          : await ordersUpdate(orderNo, toPatchBody(values, priceMasked));
      } catch (error) {
        throw noticeFrom(error, form, setNotice, orderNo !== null);
      }
    },
    [form, orderNo, priceMasked],
  );

  const onSaved = useCallback(
    async (answer: Answer, andNew: boolean) => {
      const saved = answer.data;
      await queryClient.invalidateQueries();
      if (orderNo === null) {
        toast.done(
          t(andNew ? "form.toast.createdNew" : "form.toast.created", {
            orderNo: saved.orderNo,
          }),
        );
        if (!andNew) {
          void navigate(`/orders/${saved.orderNo}`, { replace: true });
        }
        return;
      }
      if (saved.version !== null) setOrderVersion(form, saved.version);
      toast.done(t("form.toast.updated", { orderNo }));
    },
    [form, navigate, orderNo, queryClient, t],
  );

  // A repeated PO number is only true of the pair that was refused.
  const shown =
    notice?.kind === "duplicate" &&
    (notice.customerNo !== customer?.number || notice.po !== po)
      ? null
      : notice;
  return { onSave, onSaved, serverPaths: SERVER_PATHS, notice: shown };
}

function noticeFrom(
  error: unknown,
  form: OrderForm,
  setNotice: (notice: OrderNotice) => void,
  saved: boolean,
): unknown {
  if (!(error instanceof ApiError) || error.code !== "CONFLICT") return error;
  const existing = existingOrderOf(error.details);
  if (existing === null) {
    if (saved) setNotice({ kind: "stale" });
    return error;
  }
  setNotice({
    kind: "duplicate",
    orderNo: existing,
    customerNo: form.getValues("customer")?.number ?? "",
    po: form.getValues("externalDocumentNo"),
  });
  return new ApiError(
    error.code,
    error.message,
    error.status,
    error.traceId,
    error.details.filter((issue) => issue.path !== DUPLICATE_ORDER_PATH),
    error.fromEnvelope,
  );
}
