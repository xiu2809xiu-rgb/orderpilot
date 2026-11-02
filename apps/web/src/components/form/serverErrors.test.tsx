import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import i18n from "@/i18n";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { axeViolations } from "@/test/axe";
import {
  FormActions,
  FormGrid,
  FormShell,
  SaveButton,
  TextField,
  useFormSave,
  useZodForm,
} from "./index";
import { KitForm, LABELS, renderInRouter, signInAs, VALID } from "./kitHarness";

beforeAll(async () => {
  await i18n.loadNamespaces("form");
});

beforeEach(() => {
  localStorage.clear();
  signInAs("SUPPORT");
});

const TRACE = "trace-test-0042";

function invalid(...details: { path: string; message: string }[]) {
  return new ApiError(
    "VALIDATION_FAILED",
    "The request is not valid.",
    400,
    TRACE,
    details,
  );
}

/** Renders a valid, changed form whose save fails with `error`, and saves it. */
async function saveFailing(error: Error) {
  const user = userEvent.setup();
  renderInRouter(
    <KitForm defaults={VALID} onSave={() => Promise.reject(error)} />,
  );
  await user.type(
    await screen.findByRole("textbox", { name: LABELS.remarks }),
    "Fragile",
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
  return user;
}

const box = (name: string) => screen.getByRole("textbox", { name });

describe("server errors on a form", () => {
  it("a nested path lands on its field, in the server's words, and takes focus", async () => {
    await saveFailing(
      invalid({
        path: "lines.1.quantity",
        message: "Only 40 units of I-0007 are free to promise.",
      }),
    );
    const line = box(LABELS.line(2));
    expect(
      await screen.findByText("Only 40 units of I-0007 are free to promise."),
    ).toBeVisible();
    expect(line).toHaveAttribute("aria-invalid", "true");
    expect(line).toHaveAccessibleDescription(
      expect.stringContaining("Only 40 units of I-0007 are free to promise."),
    );
    expect(line).toHaveFocus();
    expect(box(LABELS.line(1))).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("the field highest on the page takes focus, whatever the server's order", async () => {
    await saveFailing(
      invalid(
        { path: "lines.0.quantity", message: "Order whole cartons of 20." },
        {
          path: "customerPo",
          message: "PO number CPO-7731 is already on order SO-20261030-0007.",
        },
      ),
    );
    await screen.findByText("Order whole cartons of 20.");
    expect(box(LABELS.customerPo)).toHaveFocus();
    expect(box(LABELS.customerPo)).toHaveAttribute("aria-invalid", "true");
  });

  it("an issue with no field goes to the form-level error, with the trace id", async () => {
    await saveFailing(
      invalid(
        {
          path: "warehouseCode",
          message: "Warehouse SG-02 is closed for a stock count.",
        },
        { path: "customerPo", message: "PO number CPO-7731 is already used." },
      ),
    );
    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("Warehouse SG-02 is closed for a stock count."),
    ).toBeVisible();
    expect(within(alert).getByText(TRACE)).toBeVisible();
    expect(
      screen.getByText("PO number CPO-7731 is already used."),
    ).toBeVisible();
    // A field took focus, so the summary does not steal it.
    expect(box(LABELS.customerPo)).toHaveFocus();
  });

  it("a conflict shows the server's message and the trace id, and takes focus", async () => {
    await saveFailing(
      new ApiError(
        "CONFLICT",
        "Someone else changed this order after you opened it.",
        409,
        TRACE,
      ),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Someone else changed this order after you opened it.",
    );
    expect(alert).toHaveTextContent(TRACE);
    await waitFor(() => {
      expect(alert).toHaveFocus();
    });
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("a refusal shows the server's words", async () => {
    await saveFailing(
      new ApiError("FORBIDDEN", "You are not allowed to do this.", 403, TRACE),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You are not allowed to do this.",
    );
  });

  it("a server failure shows our words, never the server's, with the trace id", async () => {
    await saveFailing(
      new ApiError("INTERNAL_ERROR", "pg: relation missing", 500, TRACE),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The server had a problem.");
    expect(alert).not.toHaveTextContent("pg: relation missing");
    expect(alert).toHaveTextContent(TRACE);
  });

  it("an answer that was not our envelope never shows its text", async () => {
    await saveFailing(
      new ApiError("CONFLICT", "Unexpected response.", 409, TRACE, [], false),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Someone else changed this first.");
  });

  it("a lost connection and an ended session each say what to do", async () => {
    await saveFailing(new NetworkError("offline", TRACE));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "OrderPilot could not reach the server.",
    );
  });

  it("an ended session asks for a sign-in, then a save again", async () => {
    await saveFailing(
      new ApiError("UNAUTHENTICATED", "You are not signed in.", 401, TRACE),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Not saved: your session ended. Sign in, then save again.",
    );
  });

  it("a failed save keeps the changes and the draft, and the next save clears the error", async () => {
    const user = userEvent.setup();
    let fail = true;
    renderInRouter(
      <KitForm
        defaults={VALID}
        onSave={() =>
          fail
            ? Promise.reject(
                new ApiError(
                  "CONFLICT",
                  "Changed by someone else.",
                  409,
                  TRACE,
                ),
              )
            : Promise.resolve()
        }
      />,
    );
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.remarks }),
      "Fragile",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alert");
    expect(box(LABELS.remarks)).toHaveValue("Fragile");
    expect(
      Object.keys(localStorage).some((key) => key.startsWith("op.draft.")),
    ).toBe(true);

    fail = false;
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
    expect(
      Object.keys(localStorage).some((key) => key.startsWith("op.draft.")),
    ).toBe(false);
  });

  it("a nested path under a lookup lands on the lookup", async () => {
    await saveFailing(
      invalid({
        path: "customer.number",
        message: "This customer is blocked.",
      }),
    );
    const lookup = await screen.findByRole("combobox", {
      name: LABELS.customer,
    });
    expect(lookup).toHaveAttribute("aria-invalid", "true");
    expect(lookup).toHaveAccessibleDescription(/This customer is blocked/);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a path map renames the server's names to the form's, row by row", async () => {
    const user = userEvent.setup();
    const error = invalid(
      { path: "customerNo", message: "Customer C-0002 is on hold." },
      { path: "lines.1.itemNo", message: "Item I-0007 is not stocked." },
    );
    renderInRouter(
      <KitForm
        defaults={VALID}
        onSave={() => Promise.reject(error)}
        serverPaths={{
          customerNo: "customer",
          "lines.*.itemNo": "lines.*.quantity",
        }}
      />,
    );
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.remarks }),
      "x",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Customer C-0002 is on hold."),
    ).toBeVisible();
    expect(screen.getByText("Item I-0007 is not stocked.")).toBeVisible();
    expect(box(LABELS.line(2))).toHaveAttribute("aria-invalid", "true");
    expect(box(LABELS.line(1))).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

const rulesSchema = z.object({
  po: z.string(),
  lines: z.array(z.object({ q: z.string() })).min(1, "Add at least one line."),
});

function NoFieldForm({ onSave }: { onSave: () => Promise<void> }) {
  const form = useZodForm<
    z.input<typeof rulesSchema>,
    z.output<typeof rulesSchema>
  >({ schema: rulesSchema, defaultValues: { po: "", lines: [] } });
  const save = useFormSave(form, { onSave });
  return (
    <FormShell form={form}>
      <FormGrid>
        <TextField control={form.control} name="po" label="PO" />
      </FormGrid>
      <FormActions>
        <SaveButton form={form} onSave={save} />
      </FormActions>
    </FormShell>
  );
}

describe("a rule the schema refuses where no field shows it", () => {
  it("is said at the top, takes focus, and sends nothing", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.resolve());
    renderInRouter(<NoFieldForm onSave={onSave} />);
    await user.type(await screen.findByRole("textbox", { name: "PO" }), "A");
    await user.click(screen.getByRole("button", { name: "Save" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Add at least one line.");
    await waitFor(() => {
      expect(alert).toHaveFocus();
    });
    expect(onSave).not.toHaveBeenCalled();
  });
});
