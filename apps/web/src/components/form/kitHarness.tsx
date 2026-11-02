// Test-only: a small form built from the kit, so each test drives a real one.
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { z } from "zod";
import { sessionFor } from "@/test/fixtures";
import { useSessionStore } from "@/stores/session";
import type { Role } from "@orderpilot/shared";
import { CheckboxField } from "./CheckboxField";
import { DateField } from "./DateField";
import { FormActions } from "./FormActions";
import { FormGrid } from "./FormGrid";
import { FormShell } from "./FormShell";
import { LookupField } from "./LookupField";
import { MoneyField } from "./MoneyField";
import { NumberField } from "./NumberField";
import { SaveButton } from "./SaveButton";
import type { SaveOptions } from "./useSaveReason";
import { SelectField } from "./SelectField";
import { TextAreaField } from "./TextAreaField";
import { TextField } from "./TextField";
import { useDraft } from "./useDraft";
import { useFormSave } from "./useFormSave";
import { useSaveShortcut } from "./useSaveShortcut";
import { useZodForm } from "./useZodForm";
import type { PathMap } from "./serverErrors";
import { requiredLookup, type LookupOption, type LookupSearch } from "./lookup";

export const kitSchema = z.object({
  customerPo: z.string().trim().min(1, "Enter the customer's PO number."),
  quantity: z.string().regex(/^\d+$/, "Enter a whole number."),
  price: z.string().regex(/^\d+\.\d{2}$/, "Enter an amount such as 12.50."),
  shipBy: z.iso.date("Enter the ship-by date."),
  terms: z.string().min(1, "Choose the payment terms."),
  remarks: z.string().max(10, "Keep remarks to 10 characters."),
  partial: z.boolean(),
  customer: requiredLookup("Choose a customer from the list."),
  creditLimit: z.string(),
  lines: z.array(z.object({ quantity: z.string() })),
});
export type KitInput = z.input<typeof kitSchema>;
export type KitOutput = z.output<typeof kitSchema>;

export function kitDefaults(): KitInput {
  return {
    customerPo: "",
    quantity: "",
    price: "",
    shipBy: "",
    terms: "",
    remarks: "",
    partial: false,
    customer: null,
    creditLimit: "",
    lines: [{ quantity: "" }, { quantity: "" }],
  };
}

export const KIT_CUSTOMERS: readonly LookupOption[] = [
  { number: "C-0001", name: "Quillon Harbour Traders", detail: "IN" },
  { number: "C-0002", name: "Brindle Coast Imports", detail: "LK" },
  { number: "C-0010", name: "Dunefall General Trading LLC", detail: "AE" },
];

/** Values that pass the schema, as a loaded record would have. */
export const VALID: Partial<KitInput> = {
  customerPo: "CPO-7731",
  quantity: "12",
  price: "18.40",
  shipBy: "2026-11-20",
  terms: "PREPAID",
  customer: { number: "C-0002", name: "Brindle Coast Imports" },
};

export const TERMS = [
  { value: "30 DAYS", label: "30 days" },
  { value: "PREPAID", label: "Prepaid" },
];

export function signInAs(role: Role) {
  const session = sessionFor(role);
  useSessionStore.setState({ status: "active", session });
  return session;
}

/** Renders `ui` at "/" in a data router, with a second page to leave for. */
export function renderInRouter(ui: ReactNode, elsewhere?: ReactNode) {
  const router = createMemoryRouter(
    [
      { path: "/", element: ui },
      { path: "/elsewhere", element: elsewhere ?? <main /> },
    ],
    { initialEntries: ["/"] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

export const LABELS = {
  form: "Order header",
  customerPo: "Customer PO number",
  quantity: "Quantity",
  price: "Unit price",
  shipBy: "Ship by",
  terms: "Payment terms",
  remarks: "Remarks",
  partial: "Partial shipment allowed",
  customer: "Customer",
  creditLimit: "Credit limit",
  line: (n: number) => `Line ${String(n)} quantity`,
};

interface KitFormProps {
  onSave?: (values: KitOutput) => Promise<unknown>;
  search?: LookupSearch;
  readOnly?: boolean;
  disabled?: boolean;
  draftKey?: string;
  debounceMs?: number;
  lookupDebounceMs?: number;
  /** Starting values, as a loaded record would give. */
  defaults?: Partial<KitInput>;
  serverPaths?: PathMap;
  saveOptions?: SaveOptions;
  onPick?: (option: LookupOption) => void;
}

const kitSearch: LookupSearch = (query) =>
  Promise.resolve(
    KIT_CUSTOMERS.filter((c) =>
      `${c.number} ${c.name}`.toLowerCase().includes(query.toLowerCase()),
    ),
  );

/** Every kit field in one form, with a draft that leaves the credit limit out. */
export function KitForm({
  onSave = () => Promise.resolve(),
  search = kitSearch,
  readOnly,
  disabled,
  draftKey = "test.order",
  debounceMs = 0,
  lookupDebounceMs = 0,
  defaults,
  serverPaths,
  saveOptions,
  onPick,
}: KitFormProps) {
  const form = useZodForm<KitInput, KitOutput>({
    schema: kitSchema,
    defaultValues: { ...kitDefaults(), ...defaults },
  });
  const draft = useDraft(draftKey, form, {
    exclude: ["creditLimit"],
    debounceMs,
  });
  const save = useFormSave(form, { onSave, draft, serverPaths });
  useSaveShortcut(form, save, saveOptions);
  const common = { control: form.control, readOnly, disabled };
  return (
    <FormShell form={form} draft={draft} aria-label={LABELS.form}>
      <FormGrid>
        <TextField
          {...common}
          name="customerPo"
          label={LABELS.customerPo}
          required
          code
        />
        <NumberField
          {...common}
          name="quantity"
          label={LABELS.quantity}
          unit="PCS"
          required
        />
        <MoneyField
          {...common}
          name="price"
          label={LABELS.price}
          currency="USD"
          required
        />
        <DateField {...common} name="shipBy" label={LABELS.shipBy} required />
        <SelectField
          {...common}
          name="terms"
          label={LABELS.terms}
          options={TERMS}
          required
        />
        <TextAreaField {...common} name="remarks" label={LABELS.remarks} />
        <CheckboxField {...common} name="partial" label={LABELS.partial} />
        <LookupField
          {...common}
          name="customer"
          label={LABELS.customer}
          search={search}
          onPick={onPick}
          debounceMs={lookupDebounceMs}
          required
        />
        <MoneyField
          {...common}
          name="creditLimit"
          label={LABELS.creditLimit}
          currency="USD"
        />
        <NumberField
          {...common}
          name="lines.0.quantity"
          label={LABELS.line(1)}
        />
        <NumberField
          {...common}
          name="lines.1.quantity"
          label={LABELS.line(2)}
        />
      </FormGrid>
      <FormActions>
        <SaveButton form={form} onSave={save} {...saveOptions} />
      </FormActions>
    </FormShell>
  );
}
