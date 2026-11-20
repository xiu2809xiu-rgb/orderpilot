import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { CommandPalette } from "./CommandPalette";
import {
  loadPaletteWords,
  orderRow,
  resetPalette,
  serve,
} from "./paletteTestKit";
import { SparkPanelProvider, useSparkPanel } from "./sparkPanel";

beforeAll(loadPaletteWords);
afterEach(() => {
  resetPalette();
  vi.unstubAllEnvs();
});

function Probe() {
  const { pathname } = useLocation();
  const spark = useSparkPanel();
  return (
    <output data-testid="probe">{`${pathname} spark:${String(spark.open)}`}</output>
  );
}

/** A page with a button that opens the palette, as the top bar does. */
function Page() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Search trigger
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} />
      <Probe />
    </>
  );
}

function show(role: Parameters<typeof sessionFor>[0], demo: boolean) {
  vi.stubEnv("DEV", false);
  useSessionStore.getState().setSession({ ...sessionFor(role), demo });
  return render(
    <MemoryRouter>
      <SparkPanelProvider>
        <Page />
      </SparkPanelProvider>
    </MemoryRouter>,
  );
}

async function openPalette(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Search trigger" }));
  return screen.findByRole("combobox");
}

const goTo = () => within(screen.getByRole("group", { name: "Go to" }));

describe("Upload and Spark in the palette", () => {
  it("lists both under Go to in a demo session, with the top bar's labels", async () => {
    const user = userEvent.setup();
    show("SUPPORT", true);
    await openPalette(user);
    expect(goTo().getByRole("option", { name: "Upload" })).toBeVisible();
    expect(goTo().getByRole("option", { name: "Spark" })).toBeVisible();
  });

  it("opens the upload page from its row", async () => {
    const user = userEvent.setup();
    show("SUPPORT", true);
    await openPalette(user);
    await user.click(goTo().getByRole("option", { name: "Upload" }));
    expect(screen.getByTestId("probe")).toHaveTextContent("/upload");
  });

  it("opens the Spark panel from its row, and finds it by typing", async () => {
    const user = userEvent.setup();
    show("SUPPORT", true);
    await user.keyboard("{Tab}");
    const box = await openPalette(user);
    await user.type(box, "spark");
    await user.click(await screen.findByRole("option", { name: "Spark" }));
    await waitFor(() => {
      expect(screen.getByTestId("probe")).toHaveTextContent("spark:true");
    });
    expect(screen.getByTestId("probe")).toHaveTextContent("/");
  });

  it("offers neither outside a demo session", async () => {
    const user = userEvent.setup();
    show("SUPPORT", false);
    const box = await openPalette(user);
    expect(screen.queryByRole("option", { name: "Upload" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Spark" })).toBeNull();
    await user.type(box, "upload");
    expect(screen.queryByRole("option", { name: "Upload" })).toBeNull();
  });

  it("leaves Upload to the roles that may upload, as the top bar does", async () => {
    const user = userEvent.setup();
    show("WAREHOUSE", true);
    await openPalette(user);
    expect(screen.queryByRole("option", { name: "Upload" })).toBeNull();
    expect(goTo().getByRole("option", { name: "Spark" })).toBeVisible();
  });
});

describe("Escape in the palette", () => {
  it("gives focus back to what had it when the palette opened", async () => {
    const user = userEvent.setup();
    show("SUPPORT", true);
    const trigger = screen.getByRole("button", { name: "Search trigger" });
    await openPalette(user);
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("combobox")).toBeNull();
    });
    expect(trigger).toHaveFocus();
  });

  it("puts focus on the page's main region when nothing had it, not on the body", async () => {
    const user = userEvent.setup();
    vi.stubEnv("DEV", false);
    useSessionStore
      .getState()
      .setSession({ ...sessionFor("SUPPORT"), demo: true });
    // The shell opens the palette from the keyboard, with nothing focused.
    function KeyPage() {
      const [open, setOpen] = useState(false);
      useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
          if (event.ctrlKey && event.key.toLowerCase() === "k") setOpen(true);
        };
        document.addEventListener("keydown", onKey);
        return () => {
          document.removeEventListener("keydown", onKey);
        };
      }, []);
      return (
        <>
          <main id="main" tabIndex={-1}>
            A page
          </main>
          <CommandPalette open={open} onOpenChange={setOpen} />
        </>
      );
    }
    render(
      <MemoryRouter>
        <SparkPanelProvider>
          <KeyPage />
        </SparkPanelProvider>
      </MemoryRouter>,
    );
    expect(document.body).toHaveFocus();
    await user.keyboard("{Control>}k{/Control}");
    await screen.findByRole("combobox");
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("combobox")).toBeNull();
    });
    expect(document.getElementById("main")).toHaveFocus();
  });
});

describe("a voided order in the palette", () => {
  it("says Void beside its number, and an ordinary order does not", async () => {
    const user = userEvent.setup();
    serve({
      orders: [
        {
          ...orderRow("SO-20261120-0005", "Meridian Vale", "W-5"),
          captureState: "void",
        },
        orderRow("SO-0082", "Meridian Vale", "4471-26"),
      ],
    });
    show("SUPPORT", true);
    const box = await openPalette(user);
    await user.type(box, "Meridian");
    const voided = await screen.findByRole("option", {
      name: /SO-20261120-0005/,
    });
    expect(voided).toHaveTextContent("SO-20261120-0005Void");
    expect(voided).toHaveAccessibleName(/Void/);
    const plain = screen.getByRole("option", { name: /SO-0082/ });
    expect(plain).not.toHaveTextContent("Void");
  });
});
