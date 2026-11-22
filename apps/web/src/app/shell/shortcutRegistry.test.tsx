import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PageHeader } from "@/components/common";
import { DataTable } from "@/components/common/data-table/DataTable";
import { DEFAULT_QUERY } from "@/components/common/data-table/types";
import { Toaster } from "@/components/common/Toaster";
import { toast } from "@/components/common/toast";
import {
  KitForm,
  LABELS,
  renderInRouter,
  signInAs,
  VALID,
} from "@/components/form/kitHarness";
import { ReasonDialog } from "@/components/list-page/ReasonDialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { renderApp } from "@/test/render";
import { loadShellOverlays } from "./overlays/preload";
import { PanelHelp } from "./PanelHelp";
import {
  SHORTCUTS,
  keyParts,
  shortcut,
  type Shortcut,
  type ShortcutId,
} from "./shortcutRegistry";
import { useGlobalShortcuts } from "./shortcuts";
import { SparkPanelProvider, useSparkPanel } from "./sparkPanel";

const demo = vi.hoisted(() => ({ available: true }));
vi.mock("./demoParts", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useDemoParts: () => demo.available,
}));
vi.mock("@/features/directions/spark/orb/orbGpu", () => ({
  prepareOrbGpu: () => Promise.resolve(null),
}));

beforeAll(async () => {
  await i18n.loadNamespaces(["common", "form", "list-page", "components"]);
  await loadShellOverlays();
});

afterEach(() => {
  demo.available = true;
  vi.restoreAllMocks();
});

/** Presses the keys the registry names for an entry, the way a person would. */
function press(entry: Shortcut) {
  const token = entry.key.length === 1 ? entry.key : `{${entry.key}}`;
  return userEvent.keyboard(entry.mod ? `{Control>}${token}{/Control}` : token);
}

function Lists({ onNew }: { onNew: () => void }) {
  useGlobalShortcuts();
  return (
    <>
      <PageHeader
        title="Orders"
        primaryAction={{ label: "New order", onRun: onNew }}
      />
      <DataTable
        tableId="registry"
        caption="Orders"
        columns={[{ id: "a", header: "A", cell: () => "x" }]}
        rows={[]}
        total={0}
        query={DEFAULT_QUERY}
        onQueryChange={() => undefined}
        rowKey={() => "1"}
      />
    </>
  );
}

function SparkProbe() {
  const spark = useSparkPanel();
  return <output>{spark.open ? "spark open" : "spark closed"}</output>;
}

function Closable() {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>Sample dialog</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}

describe("the shortcut registry", () => {
  it("gives each key combination to one shortcut only", () => {
    const seen = SHORTCUTS.map((entry) => `${String(entry.mod)}:${entry.key}`);
    expect(new Set(seen).size).toBe(SHORTCUTS.length);
  });

  it("draws Ctrl and a key as two parts, and Esc by its short name", () => {
    expect(keyParts(shortcut("palette"), "Win32")).toEqual(["Ctrl", "K"]);
    expect(keyParts(shortcut("palette"), "MacIntel")).toEqual(["Cmd", "K"]);
    expect(keyParts(shortcut("close"))).toEqual(["Esc"]);
    expect(keyParts(shortcut("search"))).toEqual(["/"]);
  });
});

describe("the handlers answer to the keys the registry names", () => {
  const handled: Record<ShortcutId, () => Promise<void>> = {
    palette: async () => {
      renderApp("/", { session: sessionFor("SUPPORT") });
      await screen.findByRole("button", { name: "Help" });
      await press(shortcut("palette"));
      expect(await screen.findByRole("combobox")).toBeInTheDocument();
    },
    spark: async () => {
      useSessionStore.getState().setSession(sessionFor("SUPPORT"));
      render(
        <MemoryRouter>
          <SparkPanelProvider>
            <SparkProbe />
          </SparkPanelProvider>
        </MemoryRouter>,
      );
      expect(screen.getByText("spark closed")).toBeInTheDocument();
      await press(shortcut("spark"));
      expect(await screen.findByText("spark open")).toBeInTheDocument();
    },
    close: async () => {
      render(<Closable />);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      await press(shortcut("close"));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    },
    undo: async () => {
      render(<Toaster />);
      const undo = vi.fn();
      toast.done("Disabled Synthetic Person", { undo });
      await screen.findByText("Disabled Synthetic Person");
      await press(shortcut("undo"));
      expect(undo).toHaveBeenCalledTimes(1);
    },
    search: async () => {
      render(<Lists onNew={() => undefined} />);
      await press(shortcut("search"));
      expect(screen.getByRole("searchbox", { name: "Search" })).toHaveFocus();
    },
    new: async () => {
      const onNew = vi.fn();
      render(<Lists onNew={onNew} />);
      await press(shortcut("new"));
      expect(onNew).toHaveBeenCalledTimes(1);
    },
    save: async () => {
      signInAs("SUPPORT");
      const onSave = vi.fn(() => Promise.resolve());
      renderInRouter(<KitForm defaults={VALID} onSave={onSave} />);
      const field = await screen.findByRole("textbox", { name: LABELS.price });
      await userEvent.clear(field);
      await userEvent.type(field, "1,200.5");
      await press(shortcut("save"));
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });
    },
    confirm: async () => {
      const onConfirm = vi.fn(() => Promise.resolve());
      render(
        <>
          <ReasonDialog
            open
            onOpenChange={() => undefined}
            title="Disable Synthetic Person"
            confirmLabel="Disable"
            doneMessage="Disabled"
            onConfirm={onConfirm}
          />
          <Toaster />
        </>,
      );
      await userEvent.type(
        await screen.findByRole("textbox"),
        "Left the company",
      );
      await press(shortcut("confirm"));
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith("Left the company");
      });
    },
  };

  it("has a check for every entry, so a new key cannot be added unchecked", () => {
    expect(Object.keys(handled).sort()).toEqual(
      SHORTCUTS.map((entry) => entry.id).sort(),
    );
  });

  it.each(SHORTCUTS.map((entry) => entry.id))("%s", async (id) => {
    await handled[id]();
  });
});

describe("the Help panel draws from the same list", () => {
  function renderHelp() {
    useSessionStore.getState().setSession(sessionFor("SUPPORT"));
    return render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SparkPanelProvider>
            <PanelHelp collapsed={false} />
          </SparkPanelProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("lists the quick keys by their registry labels, Spark included where it exists", async () => {
    renderHelp();
    await userEvent.click(screen.getByRole("button", { name: "Help" }));
    const help = await screen.findByRole("dialog");
    for (const entry of SHORTCUTS.filter((item) => item.quick)) {
      expect(
        within(help).getByText(i18n.t(`shortcuts.${entry.id}`)),
      ).toBeInTheDocument();
    }
    expect(within(help).queryByText(i18n.t("shortcuts.save"))).toBeNull();
  });

  it("leaves Spark out where it is not offered", async () => {
    demo.available = false;
    renderHelp();
    await userEvent.click(screen.getByRole("button", { name: "Help" }));
    const help = await screen.findByRole("dialog");
    expect(within(help).getByText(i18n.t("shortcuts.palette"))).toBeVisible();
    expect(within(help).queryByText(i18n.t("shortcuts.spark"))).toBeNull();
  });
});
