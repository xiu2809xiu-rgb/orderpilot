import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { axeViolations } from "@/test/axe";
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
});
