import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { STOCK_ANSWER } from "../data";
import SparkPanel from "./SparkPanel";

// The test runner asks for reduced motion: the pause before an answer is short
// and the words arrive whole, so the tests wait for roles, not for timers.
function reduceMotion() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function panel(onOpenChange = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={["/directions/spectra/home"]}>
      <Routes>
        <Route
          path="/directions/:direction/:screen"
          element={<SparkPanel open onOpenChange={onOpenChange} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeAll(async () => {
  await i18n.loadNamespaces([
    "directions",
    "directions-spark",
    "directions-parts",
  ]);
});

beforeEach(() => {
  reduceMotion();
  useSessionStore.setState({
    status: "active",
    session: sessionFor("SUPPORT"),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Spark panel", () => {
  it("opens on a welcome with the orb, the suggested question and the honest label", async () => {
    panel();
    const dialog = await screen.findByRole("dialog", { name: "Spark" });
    expect(
      within(dialog).getByRole("img", { name: "Spark is ready" }),
    ).toBeVisible();
    expect(
      within(dialog).getByRole("button", {
        name: "How many HP monitors do we have?",
      }),
    ).toBeVisible();
    expect(
      within(dialog).getByText(
        "Preview: scripted answers. Spark's real tools come with P-95 to P-99.",
      ),
    ).toBeVisible();
    // The sales question needs a role that may read sales: Support does not.
    expect(
      within(dialog).queryByRole("button", {
        name: /How have sales moved/,
      }),
    ).toBeNull();
  });

  it("answers the stock question from the data, with a table, a source chip and a draft", async () => {
    const user = userEvent.setup();
    panel();
    const dialog = await screen.findByRole("dialog", { name: "Spark" });
    await user.click(
      within(dialog).getByRole("button", {
        name: "How many HP monitors do we have?",
      }),
    );
    const item = STOCK_ANSWER.items[0];
    expect(item).toBeDefined();
    const table = await within(dialog).findByRole("table", {
      name: "HP monitors in stock",
    });
    const header = within(table)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);
    expect(header).toEqual([
      "Item",
      "Part number",
      "On hand",
      "On sales orders",
      "Available",
      "On purchase orders",
    ]);
    const cells = within(table)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
    expect(cells).toEqual([item?.partNumber, "880", "6", "1,020", "146"]);
    expect(
      within(dialog).getByRole("link", {
        name: "Open item I-0025 in master data",
      }),
    ).toHaveAttribute("href", "/master-data/items/I-0025");
    expect(within(dialog).getByText(/1,020 are available/)).toBeVisible();
    // The draft is two real fields, and Copy is the only action: Spark never sends.
    const subject = within(dialog).getByRole("textbox", { name: "Subject" });
    expect(subject).toHaveValue("Stock of HP Monitor 24-inch");
    const message = within(dialog).getByRole("textbox", { name: "Message" });
    expect(message).toBeInstanceOf(HTMLTextAreaElement);
    expect((message as HTMLTextAreaElement).value).toContain(
      "We have 1,020 available now",
    );
    expect(
      within(dialog).getByRole("button", { name: "Copy draft" }),
    ).toBeVisible();
    expect(
      within(dialog).queryByRole("button", { name: /^send$/i }),
    ).toBeNull();
    expect(
      within(dialog).getByRole("button", { name: "New conversation" }),
    ).toBeVisible();
  });

  it("lets a person edit the draft before copying it", async () => {
    const user = userEvent.setup();
    panel();
    const dialog = await screen.findByRole("dialog", { name: "Spark" });
    await user.click(
      within(dialog).getByRole("button", {
        name: "How many HP monitors do we have?",
      }),
    );
    const subject = await within(dialog).findByRole("textbox", {
      name: "Subject",
    });
    await user.clear(subject);
    await user.type(subject, "Monitor stock");
    expect(subject).toHaveValue("Monitor stock");
  });

  it("answers a typed stock question, and says what it cannot answer", async () => {
    const user = userEvent.setup();
    panel();
    const dialog = await screen.findByRole("dialog", { name: "Spark" });
    const field = within(dialog).getByRole("textbox", { name: "Ask Spark" });
    await user.type(field, "Is there any stock of HP?{Enter}");
    expect(
      await within(dialog).findByRole("table", {
        name: "HP monitors in stock",
      }),
    ).toBeVisible();
    await user.type(field, "What is the weather?{Enter}");
    expect(
      await within(dialog).findByText(/Your role cannot read sales figures/),
    ).toBeVisible();
  });

  it("answers the sales question for a role that may read sales, with a chart and its table", async () => {
    useSessionStore.setState({
      status: "active",
      session: sessionFor("MANAGEMENT"),
    });
    const user = userEvent.setup();
    panel();
    const dialog = await screen.findByRole("dialog", { name: "Spark" });
    await user.click(
      within(dialog).getByRole("button", {
        name: "How have sales moved over the last 12 months?",
      }),
    );
    const chart = await within(dialog).findByRole("img", {
      name: /Sales by month in USD millions/,
    });
    expect(chart).toBeVisible();
    expect(
      within(dialog).getByText(
        /came to USD 172\.4 million, 4\.1 percent higher/,
      ),
    ).toBeVisible();
    expect(within(dialog).getByText("Open in dashboard")).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: "Show as a table" }),
    );
    const table = within(dialog).getByRole("table", {
      name: "Sales by month in USD millions",
    });
    // 12 months seen, 6 forecast, and the header row.
    expect(within(table).getAllByRole("row")).toHaveLength(19);
    expect(within(table).getAllByText("Forecast")).toHaveLength(6);
  });

  it("stops an answer where it is and says so", async () => {
    // A slower pause, so there is a moment to press Stop in.
    vi.unstubAllGlobals();
    const user = userEvent.setup();
    panel();
    const dialog = await screen.findByRole("dialog", { name: "Spark" });
    await user.click(
      within(dialog).getByRole("button", {
        name: "How many HP monitors do we have?",
      }),
    );
    expect(
      within(dialog).getByRole("img", { name: "Spark is working" }),
    ).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: "Stop answering" }),
    );
    expect(
      await within(dialog).findByText(
        "Stopped before the answer was finished.",
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByRole("img", { name: "Spark is ready" }),
    ).toBeVisible();
  });

  it("closes from its button", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    panel(onOpenChange);
    const dialog = await screen.findByRole("dialog", { name: "Spark" });
    await user.click(
      within(dialog).getByRole("button", { name: "Close Spark" }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("has no accessibility violations, empty or with an answer", async () => {
    const user = userEvent.setup();
    panel();
    const dialog = await screen.findByRole("dialog", { name: "Spark" });
    expect(await axeViolations(dialog)).toEqual([]);
    await user.click(
      within(dialog).getByRole("button", {
        name: "How many HP monitors do we have?",
      }),
    );
    await within(dialog).findByRole("table", { name: "HP monitors in stock" });
    expect(await axeViolations(dialog)).toEqual([]);
  }, 60_000);
});
