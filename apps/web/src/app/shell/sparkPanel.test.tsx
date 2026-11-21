import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { SparkButton } from "@/features/directions/spark/SparkButton";
import { allFeatures } from "@/features/registry";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { renderApp } from "@/test/render";
import { SparkPanelProvider, useSparkPanel } from "./sparkPanel";

const prepare = vi.hoisted(() => vi.fn(() => Promise.resolve(null)));
vi.mock("@/features/directions/spark/orb/orbGpu", () => ({
  prepareOrbGpu: prepare,
}));

// The test runner asks for reduced motion, so the answers arrive whole.
function reduceMotion() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

/** A page with a control before the Spark button and one after it, as the top bar has. */
function Page() {
  const spark = useSparkPanel();
  return (
    <>
      <button type="button">Before</button>
      <SparkButton
        open={spark.open}
        onToggle={() => {
          spark.setOpen(!spark.open);
        }}
      />
      <button type="button">After</button>
    </>
  );
}

function mount() {
  return render(
    <MemoryRouter>
      <SparkPanelProvider>
        <Page />
      </SparkPanelProvider>
    </MemoryRouter>,
  );
}

const sparkButton = () => screen.getByRole("button", { name: "Spark" });
const panel = () => screen.findByRole("dialog", { name: "Spark" });

beforeAll(async () => {
  await i18n.loadNamespaces([
    "common",
    "directions",
    "directions-spark",
    "directions-parts",
    ...allFeatures.map((feature) => feature.namespace),
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
  // Unmount while the globals the provider's cleanup calls are still there.
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  Reflect.deleteProperty(navigator, "gpu");
});

describe("the Spark button", () => {
  it("opens the panel and puts it away again, and says which it is", async () => {
    const user = userEvent.setup();
    mount();
    expect(sparkButton()).toHaveAttribute("aria-expanded", "false");
    await user.click(sparkButton());
    const dialog = await panel();
    expect(sparkButton()).toHaveAttribute("aria-expanded", "true");
    expect(sparkButton()).toHaveAttribute("aria-controls", dialog.id);
    await user.click(sparkButton());
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(sparkButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("is in step with the shortcut: Ctrl and a full stop opens it, and the button shows it", async () => {
    const user = userEvent.setup();
    mount();
    await user.keyboard("{Control>}.{/Control}");
    await panel();
    expect(sparkButton()).toHaveAttribute("aria-expanded", "true");
  });
});

describe("the keyboard in the Spark panel", () => {
  it("puts focus in the input on opening", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(sparkButton());
    const dialog = await panel();
    await waitFor(() => {
      expect(
        within(dialog).getByRole("textbox", { name: "Ask Spark" }),
      ).toHaveFocus();
    });
  });

  it("lets Tab leave the panel in both directions, to the page", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(sparkButton());
    const dialog = await panel();
    const field = within(dialog).getByRole("textbox", { name: "Ask Spark" });
    const first = within(dialog).getAllByRole("button")[0];
    expect(first).toBeDefined();
    // Backwards from the first control: the page, not the panel's own last one.
    first?.focus();
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(false);
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    // Forwards from the last control.
    field.focus();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(false);
  });

  it.each([
    [
      "Escape",
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.keyboard("{Escape}"),
    ],
    [
      "the close button",
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole("button", { name: "Close Spark" })),
    ],
    [
      "the Spark button",
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(sparkButton()),
    ],
  ])("gives focus back to the Spark button after %s", async (_name, close) => {
    const user = userEvent.setup();
    mount();
    await user.click(sparkButton());
    await panel();
    await close(user);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await waitFor(() => {
      expect(sparkButton()).toHaveFocus();
    });
  });
});

describe("what is typed in the Spark panel", () => {
  it("survives closing and opening, and is gone for the next role", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(sparkButton());
    let dialog = await panel();
    await user.type(
      within(dialog).getByRole("textbox", { name: "Ask Spark" }),
      "half a quest",
    );
    await user.click(sparkButton());
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await user.click(sparkButton());
    dialog = await panel();
    expect(
      within(dialog).getByRole("textbox", { name: "Ask Spark" }),
    ).toHaveValue("half a quest");
    // A role change starts an empty conversation, and an empty draft with it.
    act(() => {
      useSessionStore.setState({ session: sessionFor("MANAGEMENT") });
    });
    dialog = await panel();
    await waitFor(() => {
      expect(
        within(dialog).getByRole("textbox", { name: "Ask Spark" }),
      ).toHaveValue("");
    });
    expect(within(dialog).queryByRole("list")).toBeNull();
    // Nor does it come back when the next person closes and opens Spark.
    await user.click(sparkButton());
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await user.click(sparkButton());
    dialog = await panel();
    expect(
      within(dialog).getByRole("textbox", { name: "Ask Spark" }),
    ).toHaveValue("");
  });
});

describe("the Spark button in the real top bar", () => {
  it("toggles the panel and says so", async () => {
    const user = userEvent.setup();
    renderApp("/settings", { session: sessionFor("SUPPORT") });
    await screen.findByRole("heading", { level: 1, name: "Settings" });
    const bar = screen
      .getByRole("navigation", { name: "Breadcrumb" })
      .closest("header");
    expect(bar).not.toBeNull();
    const button = within(bar ?? document.body).getByRole("button", {
      name: "Spark",
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    await panel();
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-controls", "spark-panel");
    await user.click(button);
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Spark" })).toBeNull();
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => {
      expect(button).toHaveFocus();
    });
  });
});

describe("the orb's graphics program", () => {
  /** A browser with WebGPU, motion allowed, and an idle moment at once. */
  function browser() {
    Object.defineProperty(navigator, "gpu", {
      value: { requestAdapter: () => Promise.resolve(null) },
      configurable: true,
    });
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    vi.stubGlobal("requestIdleCallback", (run: () => void) => {
      run();
      return 1;
    });
    vi.stubGlobal("cancelIdleCallback", () => undefined);
    prepare.mockClear();
  }

  it("is prepared before Spark is first opened, where Spark is available", async () => {
    browser();
    mount();
    await vi.dynamicImportSettled();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is prepared for no session that cannot open Spark", async () => {
    browser();
    vi.stubEnv("DEV", false);
    useSessionStore.setState({
      status: "active",
      session: { ...sessionFor("SUPPORT"), demo: false },
    });
    mount();
    fireEvent.pointerOver(sparkButton());
    await vi.dynamicImportSettled();
    expect(prepare).not.toHaveBeenCalled();
  });

  it("is prepared when a hand reaches the Spark button", async () => {
    browser();
    // No idle moment ever comes, so only the button can ask for it.
    vi.stubGlobal("requestIdleCallback", () => 1);
    mount();
    expect(prepare).not.toHaveBeenCalled();
    fireEvent.pointerOver(sparkButton());
    await vi.dynamicImportSettled();
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});
