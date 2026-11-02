import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import i18n from "@/i18n";
import { DateField, FormGrid, FormShell, TextField, useZodForm } from "./index";
import { renderInRouter, signInAs } from "./kitHarness";

beforeAll(async () => {
  await i18n.loadNamespaces("form");
});

beforeEach(() => {
  localStorage.clear();
  signInAs("SUPPORT");
});

// The pattern the form kit's guide shows: the rule sits on a small object of
// the fields it compares, so it runs whatever the other fields hold.
const schema = z
  .object({
    po: z.string().min(1, "Enter the PO."),
    orderDate: z.iso.date("Enter the order date."),
    shipBy: z.union([z.literal(""), z.iso.date("Enter a date.")]),
  })
  .and(
    z
      .object({ orderDate: z.string(), shipBy: z.string() })
      .superRefine((order, context) => {
        if (order.shipBy !== "" && order.shipBy < order.orderDate) {
          context.addIssue({
            code: "custom",
            path: ["shipBy"],
            message: "Ship by cannot be before the order date.",
          });
        }
      }),
  );

function DatesForm() {
  const form = useZodForm<z.input<typeof schema>, z.output<typeof schema>>({
    schema,
    defaultValues: { po: "", orderDate: "2026-11-02", shipBy: "" },
  });
  return (
    <FormShell form={form}>
      <FormGrid>
        <TextField control={form.control} name="po" label="PO" required />
        <DateField
          control={form.control}
          name="orderDate"
          label="Order date"
          required
        />
        <DateField control={form.control} name="shipBy" label="Ship by" />
      </FormGrid>
    </FormShell>
  );
}

const CLASH = "Ship by cannot be before the order date.";

describe("a rule across two fields", () => {
  it("shows at once, though other fields are still empty", async () => {
    const user = userEvent.setup();
    renderInRouter(<DatesForm />);
    const shipBy = await screen.findByLabelText("Ship by");
    await user.type(shipBy, "2020-01-01");
    await user.tab();
    expect(await screen.findByText(CLASH)).toBeVisible();
  });

  it("goes when the other field is corrected", async () => {
    const user = userEvent.setup();
    renderInRouter(<DatesForm />);
    const shipBy = await screen.findByLabelText("Ship by");
    await user.type(shipBy, "2020-01-01");
    await user.tab();
    await screen.findByText(CLASH);

    const orderDate = screen.getByLabelText(/Order date/);
    await user.clear(orderDate);
    await user.type(orderDate, "2019-01-01");
    await waitFor(() => {
      expect(screen.queryByText(CLASH)).toBeNull();
    });
  });
});
