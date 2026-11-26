import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentAction } from "@/components/document-form";
import {
  getOrdersOneQueryKey,
  ordersVoidDraft,
} from "@/lib/api/generated/endpoints/orders/orders";
import type { OrderForm } from "./orderFormValues";

/**
 * What the order's action bar offers. A new order has Save and Save and new, a
 * saved draft has Save, Submit order and Void, and anything else has nothing:
 * the bar draws only what the role holds, and the server refuses the rest again.
 * Void sends the version the form was typed against, so a draft someone else
 * changed is refused instead of voided over their work.
 */
export function useOrderActions(options: {
  form: OrderForm;
  /** Null while the order is new. */
  orderNo: string | null;
  editable: boolean;
  /** Submit order, from `useSubmitOrder`: null unless the order is a saved draft. */
  submit: DocumentAction | null;
}): DocumentAction[] {
  const { form, orderNo, editable, submit } = options;
  const { t } = useTranslation("orders");
  const queryClient = useQueryClient();
  return useMemo<DocumentAction[]>(() => {
    if (!editable) return [];
    if (orderNo === null) {
      return [
        { id: "save", kind: "save", permission: "orders.create" },
        { id: "saveNew", kind: "saveNew", permission: "orders.create" },
      ];
    }
    return [
      { id: "save", kind: "save", permission: "orders.edit" },
      ...(submit ? [submit] : []),
      {
        id: "void",
        kind: "void",
        permission: "orders.edit",
        reasoned: {
          title: t("form.void.title"),
          description: t("form.void.description"),
          confirmLabel: t("form.void.confirm"),
          doneMessage: t("form.void.done", { orderNo }),
          run: async (reason) => {
            const answer = await ordersVoidDraft(orderNo, {
              version: form.getValues("version") ?? 1,
              reason,
            });
            // The page reads the order from here, and a void one is read-only.
            queryClient.setQueryData(getOrdersOneQueryKey(orderNo), answer);
            await queryClient.invalidateQueries();
          },
        },
      },
    ];
  }, [editable, orderNo, form, queryClient, submit, t]);
}
