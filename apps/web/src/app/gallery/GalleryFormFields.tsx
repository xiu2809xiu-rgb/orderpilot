import { useTranslation } from "react-i18next";
import type { Control } from "react-hook-form";
import {
  CheckboxField,
  DateField,
  FormGrid,
  LookupField,
  MoneyField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  type LookupSearch,
} from "@/components/form";
import {
  PAYMENT_TERMS,
  type OrderInput,
  type OrderOutput,
} from "./orderFormDemo";

const LINES = [
  { item: "lines.0.item", quantity: "lines.0.quantity" },
  { item: "lines.1.item", quantity: "lines.1.quantity" },
] as const;

interface GalleryFormFieldsProps {
  control: Control<OrderInput, unknown, OrderOutput>;
  searchCustomers: LookupSearch;
  searchItems: LookupSearch;
}

/** An order header, then two lines: every kind of field, in each of its states. */
export function GalleryFormFields({
  control,
  searchCustomers,
  searchItems,
}: GalleryFormFieldsProps) {
  const { t } = useTranslation("gallery");
  const terms = PAYMENT_TERMS.map((code) => ({
    value: code,
    label: t(`form.terms.${code}`),
  }));
  return (
    <>
      <FormGrid>
        <LookupField
          control={control}
          name="customer"
          label={t("form.fields.customer")}
          search={searchCustomers}
          required
          className="sm:col-span-2"
        />
        <TextField
          control={control}
          name="customerPo"
          label={t("form.fields.customerPo")}
          required
          code
          maxLength={30}
        />
        <SelectField
          control={control}
          name="paymentTerms"
          label={t("form.fields.paymentTerms")}
          options={terms}
          required
        />
        <DateField
          control={control}
          name="orderDate"
          label={t("form.fields.orderDate")}
          required
        />
        <DateField
          control={control}
          name="shipBy"
          label={t("form.fields.shipBy")}
          hint={t("form.fields.shipByHint")}
        />
        <MoneyField
          control={control}
          name="freight"
          label={t("form.fields.freight")}
          currency="USD"
          required
        />
        <MoneyField
          control={control}
          name="creditLimit"
          label={t("form.fields.creditLimit")}
          hint={t("form.fields.creditLimitHint")}
          currency="USD"
        />
        <TextField
          control={control}
          name="currency"
          label={t("form.fields.currency")}
          hint={t("form.fields.currencyHint")}
          readOnly
        />
        <DateField
          control={control}
          name="postingDate"
          label={t("form.fields.postingDate")}
          hint={t("form.fields.postingDateHint")}
          disabled
        />
        <CheckboxField
          control={control}
          name="partialShipment"
          label={t("form.fields.partial")}
          className="sm:col-span-2"
        />
        <TextAreaField
          control={control}
          name="remarks"
          label={t("form.fields.remarks")}
          maxLength={500}
          className="sm:col-span-2 lg:col-span-4"
        />
      </FormGrid>
      <fieldset className="space-y-s2">
        <legend className="mb-s1 text-sm font-medium">
          {t("form.fields.lines")}
        </legend>
        {LINES.map((line, index) => (
          <FormGrid key={line.item}>
            <LookupField
              control={control}
              name={line.item}
              label={t("form.fields.item", { n: index + 1 })}
              search={searchItems}
              required
              className="sm:col-span-2 lg:col-span-3"
            />
            <NumberField
              control={control}
              name={line.quantity}
              label={t("form.fields.quantity", { n: index + 1 })}
              unit="PCS"
              required
            />
          </FormGrid>
        ))}
      </fieldset>
    </>
  );
}
