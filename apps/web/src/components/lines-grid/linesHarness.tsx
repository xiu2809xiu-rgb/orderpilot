// Test-only: a form with a lines grid, built the way a screen would build one.
import { render } from "@testing-library/react";
import { Profiler, type ProfilerOnRenderCallback } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { z } from "zod";
import { Toaster } from "@/components/common";
import {
  FormShell,
  requiredLookup,
  SaveButton,
  useDraft,
  useFormSave,
  useZodForm,
  type PathMap,
} from "@/components/form";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { LinesGrid } from "./LinesGrid";
import { emptyLine, lineDraftOptions } from "./lineValues";
import type {
  ItemOption,
  ItemSearch,
  LineColumn,
  LinesGridProps,
  LineValue,
} from "./types";

export const ITEMS: readonly ItemOption[] = [
  {
    number: "I-0001",
    name: "Norvale Wireless Mouse",
    detail: "NV-WM-100",
    description: "Wireless mouse, 2.4 GHz",
    unit: "PCS",
    availableStock: "40",
    unitPrice: { masked: false, value: "18.4" },
  },
  {
    number: "I-0002",
    name: "Norvale Wired Keyboard",
    detail: "NV-WK-200",
    unit: "PCS",
    availableStock: "8",
    unitPrice: { masked: false, value: "24.90" },
  },
  {
    number: "I-0101",
    name: "Vantora Dome Camera",
    detail: "VT-DC-300",
    unit: "PCS",
    availableStock: "2.5",
    unitPrice: { masked: false, value: "19.99" },
  },
];

export const searchItems: ItemSearch = (query) => {
  const needle = query.trim().toLowerCase();
  return Promise.resolve(
    ITEMS.filter((item) =>
      `${item.number} ${item.name} ${item.detail ?? ""}`
        .toLowerCase()
        .includes(needle),
    ),
  );
};

const lineSchema = z.object({
  lineId: z.string(),
  item: requiredLookup("Choose an item."),
  description: z.string(),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/, "Enter a quantity."),
  unitPrice: z.string().regex(/^(\d+(\.\d{1,4})?)?$/, "Enter a price."),
  unit: z.string(),
  availableStock: z.string().nullable(),
});
export const harnessSchema = z.object({
  lines: z.array(lineSchema).min(1, "Add at least one line."),
});
type Input = z.input<typeof harnessSchema>;
type Output = z.output<typeof harnessSchema>;

export const COLUMNS: readonly LineColumn[] = [
  { kind: "lineNo", header: "Line" },
  { kind: "item", header: "Item" },
  { kind: "description", header: "Description" },
  { kind: "quantity", header: "Quantity" },
  { kind: "unitPrice", header: "Unit price (USD)" },
  { kind: "amount", header: "Amount (USD)" },
  { kind: "availability", header: "Availability" },
  { kind: "remove", header: "Remove" },
];

export function line(partial: Partial<LineValue> = {}): LineValue {
  return { ...emptyLine(), ...partial };
}

export const SAVED: LineValue[] = [
  line({
    lineId: "L1",
    item: { number: "I-0001", name: "Norvale Wireless Mouse" },
    description: "Wireless mouse, 2.4 GHz",
    quantity: "3",
    unitPrice: "19.99",
    unit: "PCS",
    availableStock: "40",
  }),
  line({
    lineId: "L2",
    item: { number: "I-0002", name: "Norvale Wired Keyboard" },
    description: "Norvale Wired Keyboard",
    quantity: "12",
    unitPrice: "24.90",
    unit: "PCS",
    availableStock: "8",
  }),
];

interface HarnessProps extends Partial<Omit<LinesGridProps, "label">> {
  lines?: LineValue[];
  onSave?: (values: Output) => Promise<unknown>;
  serverPaths?: PathMap;
  draftKey?: string;
  /** Hears every commit of the grid, for the speed test. */
  onRender?: ProfilerOnRenderCallback;
}

function Harness({
  lines = [line()],
  onSave = () => Promise.resolve(),
  serverPaths,
  draftKey = "test.lines",
  onRender,
  ...grid
}: HarnessProps) {
  const form = useZodForm<Input, Output>({
    schema: harnessSchema,
    defaultValues: { lines },
  });
  const draft = useDraft(draftKey, form, {
    ...lineDraftOptions("lines", Boolean(grid.priceMask)),
    debounceMs: 0,
  });
  const save = useFormSave(form, { onSave, draft, serverPaths });
  return (
    <FormShell form={form} draft={draft} aria-label="Order">
      <Profiler id="grid" onRender={onRender ?? (() => undefined)}>
        <LinesGrid
          label="Order lines"
          columns={COLUMNS}
          searchItems={searchItems}
          debounceMs={0}
          {...grid}
        />
      </Profiler>
      <SaveButton form={form} onSave={save} variant="outline" />
      <Toaster />
    </FormShell>
  );
}

export function signInAs(role: Parameters<typeof sessionFor>[0]) {
  useSessionStore.setState({ status: "active", session: sessionFor(role) });
}

export function renderGrid(props: HarnessProps = {}) {
  const router = createMemoryRouter(
    [{ path: "/", element: <Harness {...props} /> }],
    { initialEntries: ["/"] },
  );
  return render(<RouterProvider router={router} />);
}
