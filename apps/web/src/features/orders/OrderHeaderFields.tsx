import { useTranslation } from "react-i18next";
import {
  DateField,
  FormGrid,
  LookupField,
  NumberField,
  TextField,
} from "@/components/form";
import type { OrderForm } from "./orderFormValues";
import { searchCustomers } from "./orderSearches";

/**
 * The order's header: the customer by search (its Navision number is what is
 * saved), the customer's PO number, the dates and the prepayment. The currency
 * is the server's, USD, and only shown. A read-only order locks every field.
 */
export function OrderHeaderFields({
  form,
  readOnly,
}: {
  form: OrderForm;
  readOnly: boolean;
}) {
  const { t } = useTranslation("orders");
  const common = { control: form.control, readOnly };
  // A page nobody can type in asks for nothing: no asterisks, no entry hints.
  const needed = readOnly ? {} : { required: true as const };
  const hint = (key: string) => (readOnly ? {} : { hint: t(key) });
  return (
    <FormGrid>
      <LookupField
        {...common}
        name="customer"
        label={t("form.fields.customer")}
        {...hint("form.fields.customerHint")}
        search={searchCustomers}
        {...needed}
        className="sm:col-span-2"
      />
      <TextField
        {...common}
        name="externalDocumentNo"
        label={t("form.fields.externalDocumentNo")}
        {...hint("form.fields.externalDocumentNoHint")}
        {...needed}
        code
        maxLength={35}
      />
      <DateField
        {...common}
        name="orderDate"
        label={t("form.fields.orderDate")}
        {...needed}
      />
      <DateField
        {...common}
        name="shipmentDate"
        label={t("form.fields.shipmentDate")}
      />
      <NumberField
        {...common}
        name="prepaymentPercent"
        label={t("form.fields.prepaymentPercent")}
        unit={t("form.fields.percentUnit")}
        scale={2}
        {...needed}
      />
      <TextField
        control={form.control}
        name="currency"
        label={t("form.fields.currency")}
        readOnly
        code
      />
    </FormGrid>
  );
}
