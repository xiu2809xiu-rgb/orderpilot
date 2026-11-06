// Test-only: a small document form built from the template, so each test
// drives a real one.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { z } from "zod";
import { TextField, useZodForm } from "@/components/form";
import { renderInRouter } from "@/components/form/kitHarness";
import { DocumentForm, type DocumentFormProps } from "./DocumentForm";
import type { DocumentAction, DocumentTabsSpec } from "./types";

export const harnessSchema = z.object({
  customerPo: z.string().trim().min(1, "Enter the customer's PO number."),
  remarks: z.string(),
});
type Input = z.input<typeof harnessSchema>;

const ALL: DocumentAction[] = [
  { id: "save", kind: "save", permission: "orders.read" },
  { id: "saveNew", kind: "saveNew", permission: "orders.read" },
  { id: "submit", kind: "submit", permission: "orders.read", run: () => 1 },
  {
    id: "approve",
    kind: "approve",
    permission: "approvals.decide",
    run: () => 1,
  },
  { id: "print", kind: "print", permission: "orders.read" },
];

export const EMPTY_TABS: DocumentTabsSpec = {
  timeline: { content: null },
  checks: { content: null },
  documents: { content: null },
};

type Over = Partial<
  Pick<
    DocumentFormProps<Input, Input, unknown>,
    | "actions"
    | "onSave"
    | "onSaved"
    | "tabs"
    | "attachments"
    | "totals"
    | "print"
    | "serverPaths"
    | "saveBlocked"
    | "allowClean"
    | "draftOptions"
  >
> & { defaults?: Partial<Input> };

function Harness({ defaults, ...over }: Over) {
  const form = useZodForm<Input>({
    schema: harnessSchema,
    defaultValues: { customerPo: "CPO-1", remarks: "", ...defaults },
  });
  return (
    <DocumentForm
      formId="harness"
      form={form}
      title="Sales order SO-1"
      number="SO-1"
      formLabel="Sales order"
      header={
        <>
          <TextField
            control={form.control}
            name="customerPo"
            label="Customer PO"
            required
          />
          <TextField control={form.control} name="remarks" label="Remarks" />
        </>
      }
      status={{ family: "waiting", label: "Waiting for approval" }}
      actions={ALL}
      draftKey="test.document"
      draftOptions={{ debounceMs: 0 }}
      onSave={() => Promise.resolve()}
      tabs={EMPTY_TABS}
      {...over}
    />
  );
}

export function renderDocument(over: Over = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderInRouter(
    <QueryClientProvider client={client}>
      <Harness {...over} />
    </QueryClientProvider>,
  );
}
