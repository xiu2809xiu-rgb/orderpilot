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
import { STOCK_ANSWER } from "../data/index";
import { availableNow, grouped, stockFacts } from "./sparkFacts";
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
        "Demo: scripted answers from the synthetic data. No AI model is connected.",
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
      "Item and part number",
      "On hand",
      "On sales orders",
      "On purchase orders",
      "Available",
    ]);
    const cells = within(table)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
    // On hand, on sales orders, on purchase orders, then Available: the same order as the words.
    expect(cells).toEqual(["880", "6", "146", "1,020"]);
    // The part number sits in the item's own cell, under its name.
    expect(within(table).getByRole("rowheader").textContent).toContain(
      item?.partNumber ?? "",
    );
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
    // The draft quotes what is here now (880 less 6), and names the 146 as due.
    const facts = stockFacts();
    const now = grouped(facts.only ? availableNow(facts.only) : 0);
    const due = grouped(facts.totals.onPurchaseOrders);
    expect((message as HTMLTextAreaElement).value).toContain(
      `We have ${now} available now. A further ${due} are due on purchase orders.`,
    );
    expect((message as HTMLTextAreaElement).value).not.toContain("1,020");
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
    await user.type(field, "Is there any stock of HP monitors?{Enter}");
    expect(
      await within(dialog).findByRole("table", {
        name: "HP monitors in stock",
      }),
    ).toBeVisible();
    await user.type(field, "What is the weather?{Enter}");
    // Support may not read sales, so the one question it can answer is offered, and no word about sales.
    const reply = await within(dialog).findByText(
      "This is a preview with scripted answers, so Spark cannot answer that one. It can answer this question:",
    );
    expect(reply).toBeVisible();
    expect(within(dialog).queryByText(/sales figures/)).toBeNull();
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
    // There is no dashboard of this chart, so the answer offers no way to one.
    expect(
      within(dialog).queryByRole("link", { name: "Open in dashboard" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Open in dashboard" }),
    ).not.toBeInTheDocument();
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

  it("maximises like a window and restores, from its button or a double click on its head", async () => {
    const user = userEvent.setup();
    panel();
    const dialog = await screen.findByRole("dialog", { name: "Spark" });
    expect(dialog).toHaveAttribute("data-maximised", "false");
    await user.click(
      within(dialog).getByRole("button", { name: "Maximise Spark" }),
    );
    expect(dialog).toHaveAttribute("data-maximised", "true");
    // Restore is the same button, now with two squares.
    await user.click(
      within(dialog).getByRole("button", {
        name: "Restore Spark to its side panel",
      }),
    );
    expect(dialog).toHaveAttribute("data-maximised", "false");
    // A double click on the head, as on a window's title bar.
    await user.dblClick(within(dialog).getByRole("heading", { name: "Spark" }));
    expect(dialog).toHaveAttribute("data-maximised", "true");
    // A double click on a button is two clicks on it, never a resize as well.
    await user.dblClick(
      within(dialog).getByRole("button", {
        name: "Restore Spark to its side panel",
      }),
    );
    expect(dialog).toHaveAttribute("data-maximised", "true");
  });

  it("keeps its size when it is closed and opened again", async () => {
    const user = userEvent.setup();
    const tree = (open: boolean) => (
      <MemoryRouter initialEntries={["/directions/spectra/home"]}>
        <Routes>
          <Route
            path="/directions/:direction/:screen"
            element={<SparkPanel open={open} onOpenChange={vi.fn()} />}
          />
        </Routes>
      </MemoryRouter>
    );
    const view = render(tree(true));
    const dialog = await screen.findByRole("dialog", { name: "Spark" });
    await user.click(
      within(dialog).getByRole("button", { name: "Maximise Spark" }),
    );
    view.rerender(tree(false));
    expect(screen.queryByRole("dialog")).toBeNull();
    view.rerender(tree(true));
    expect(
      await screen.findByRole("dialog", { name: "Spark" }),
    ).toHaveAttribute("data-maximised", "true");
  });

  it("keeps the head, the thread and the input as three parts through three questions", async () => {
    const user = userEvent.setup();
    panel();
    const dialog = await screen.findByRole("dialog", { name: "Spark" });
    const field = within(dialog).getByRole("textbox", { name: "Ask Spark" });
    const questions = [
      "How many HP monitors do we have?",
      "How many Dell monitors do we have?",
      "hello",
    ];
    for (const [index, question] of questions.entries()) {
      await user.type(field, `${question}{Enter}`);
      await within(dialog).findByRole("img", { name: "Spark is ready" });
      expect(within(dialog).getAllByText("Scripted preview")).toHaveLength(
        index + 1,
      );
      // The input is the last part of the panel, and the thread lies in the one region that scrolls.
      expect(dialog.children).toHaveLength(3);
      expect(dialog.lastElementChild).toContainElement(field);
      const region = within(dialog)
        .getByRole("list", { name: "Conversation with Spark" })
        .closest(".spark-scroll");
      expect(region).toBe(dialog.children[1]);
      expect(region?.className).toContain("overflow-y-auto");
      expect(region?.className).toContain("min-h-0");
    }
  }, 30_000);

  it.each([
    "How many Dell monitors do we have?",
    "how much stock of Dell laptops?",
    "hp",
    "What is holding up PO 4471-26?",
  ])(
    "answers %j with the plain reply, never the HP figures",
    async (question) => {
      const user = userEvent.setup();
      panel();
      const dialog = await screen.findByRole("dialog", { name: "Spark" });
      await user.type(
        within(dialog).getByRole("textbox", { name: "Ask Spark" }),
        `${question}{Enter}`,
      );
      expect(
        await within(dialog).findByText(/Spark cannot answer that one/),
      ).toBeVisible();
      expect(within(dialog).queryByRole("table")).toBeNull();
      expect(within(dialog).queryByText(/880|1,020/)).toBeNull();
      // Support reads no sales, so one suggestion: the question it can answer.
      const thread = within(dialog).getByRole("list", {
        name: "Conversation with Spark",
      });
      expect(
        await within(thread).findAllByRole("button", { name: /\?$/ }),
      ).toHaveLength(1);
      expect(
        within(thread).getByRole("button", {
          name: "How many HP monitors do we have?",
        }),
      ).toBeVisible();
    },
  );

  it("offers a role that may read sales both questions, in the plural", async () => {
    useSessionStore.setState({
      status: "active",
      session: sessionFor("MANAGEMENT"),
    });
    const user = userEvent.setup();
    panel();
    const dialog = await screen.findByRole("dialog", { name: "Spark" });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Ask Spark" }),
      "How many Dell monitors do we have?{Enter}",
    );
    expect(
      await within(dialog).findByText(
        "This is a preview with scripted answers, so Spark cannot answer that one. It can answer these questions:",
      ),
    ).toBeVisible();
    const thread = within(dialog).getByRole("list", {
      name: "Conversation with Spark",
    });
    expect(
      await within(thread).findByRole("button", {
        name: "How have sales moved over the last 12 months?",
      }),
    ).toBeVisible();
    expect(
      within(thread).getByRole("button", {
        name: "How many HP monitors do we have?",
      }),
    ).toBeVisible();
  });

  it("marks each reply as a scripted preview, beside the answer", async () => {
    const user = userEvent.setup();
    panel();
    const dialog = await screen.findByRole("dialog", { name: "Spark" });
    await user.click(
      within(dialog).getByRole("button", {
        name: "How many HP monitors do we have?",
      }),
    );
    const mark = await within(dialog).findByText("Scripted preview");
    expect(mark).toBeVisible();
    // Next to the sentence it qualifies, not only in the note under the input.
    const turn = mark.closest("li");
    expect(turn).not.toBeNull();
    expect(
      within(turn ?? document.body).getByText(/HP has one monitor/),
    ).toBeVisible();
  });

  it("keeps what is typed when the panel is closed and opened again, and empties it on send and on a new conversation", async () => {
    const user = userEvent.setup();
    const tree = (open: boolean) => (
      <MemoryRouter initialEntries={["/directions/spectra/home"]}>
        <Routes>
          <Route
            path="/directions/:direction/:screen"
            element={<SparkPanel open={open} onOpenChange={vi.fn()} />}
          />
        </Routes>
      </MemoryRouter>
    );
    const view = render(tree(true));
    const field = async () =>
      within(await screen.findByRole("dialog", { name: "Spark" })).getByRole(
        "textbox",
        { name: "Ask Spark" },
      );
    await user.type(await field(), "half a quest");
    view.rerender(tree(false));
    expect(screen.queryByRole("dialog")).toBeNull();
    view.rerender(tree(true));
    expect(await field()).toHaveValue("half a quest");
    // Sending empties it: closed and opened again, it is still empty.
    await user.clear(await field());
    await user.type(await field(), "How many HP monitors do we have?{Enter}");
    await screen.findByRole("table", { name: "HP monitors in stock" });
    view.rerender(tree(false));
    view.rerender(tree(true));
    expect(await field()).toHaveValue("");
    // A new conversation empties it too, and puts focus in the field.
    await user.type(await field(), "another draft");
    await user.click(screen.getByRole("button", { name: "New conversation" }));
    expect(await field()).toHaveValue("");
    expect(await field()).toHaveFocus();
    expect(screen.queryByRole("table")).toBeNull();
  }, 30_000);

  it("puts focus in the field when it opens, and keeps it there after a question is sent", async () => {
    const user = userEvent.setup();
    panel();
    const dialog = await screen.findByRole("dialog", { name: "Spark" });
    const field = within(dialog).getByRole("textbox", { name: "Ask Spark" });
    expect(field).toHaveFocus();
    // The suggestion's button goes with the welcome, and focus must not go with it.
    await user.click(
      within(dialog).getByRole("button", {
        name: "How many HP monitors do we have?",
      }),
    );
    await within(dialog).findByRole("table", { name: "HP monitors in stock" });
    expect(field).toHaveFocus();
    await user.type(field, "hello{Enter}");
    await within(dialog).findByText(/Spark cannot answer that one/);
    expect(field).toHaveFocus();
  }, 30_000);

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
