import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  DateField,
  FormGrid,
  LookupField,
  SelectField,
  TextField,
} from "@/components/form";
import type { DocumentInput, DocumentOutput } from "./documentDemo";
import { fakeSearch, GALLERY_CUSTOMERS, PAYMENT_TERMS } from "./orderFormDemo";

const search = fakeSearch(GALLERY_CUSTOMERS, () => false);

/** The document's header: four kit fields. A closed document is read-only. */
export function GalleryDocumentFields({
  form,
  locked,
}: {
  form: UseFormReturn<DocumentInput, unknown, DocumentOutput>;
  locked: boolean;
}) {
  const { t } = useTranslation("gallery");
  const common = { control: form.control, readOnly: locked };
  return (
    <FormGrid>
      <LookupField
        {...common}
        name="customer"
        label={t("document.fields.customer")}
        search={search}
        required
        className="sm:col-span-2"
      />
      <TextField
        {...common}
        name="customerPo"
        label={t("document.fields.customerPo")}
        required
        code
        maxLength={30}
        hint={t("document.fields.customerPoHint")}
      />
      <DateField
        {...common}
        name="orderDate"
        label={t("document.fields.orderDate")}
        required
      />
      <SelectField
        {...common}
        name="paymentTerms"
        label={t("document.fields.paymentTerms")}
        options={PAYMENT_TERMS.map((code) => ({
          value: code,
          label: t(`form.terms.${code}`),
        }))}
        required
      />
    </FormGrid>
  );
}
