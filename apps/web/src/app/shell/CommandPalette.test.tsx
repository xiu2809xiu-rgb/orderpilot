import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { Plus } from "lucide-react";
import { must } from "@/test/must";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { registerAction } from "@/lib/actions";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { CommandPalette } from "./CommandPalette";

const added: (() => void)[] = [];

beforeAll(async () => {
  await i18n.loadNamespaces(["common", "orders", "audit", "governance"]);
});

afterEach(() => {
  added.splice(0).forEach((remove) => {
    remove();
  });
  useSessionStore.setState({ status: "booting", session: null });
});

function open(role: Parameters<typeof sessionFor>[0] = "SYSTEM_ADMIN") {
  useSessionStore.getState().setSession(sessionFor(role));
  return render(
    <MemoryRouter>
      <CommandPalette open onOpenChange={() => undefined} />
    </MemoryRouter>,
  );
}

describe("command palette", () => {
  it("lists actions above navigation, and does not crash without cmdk's wrapper", async () => {
    open();
    await screen.findByRole("combobox");
    const groups = screen.getAllByRole("group");
    expect(
      within(must(groups[0])).getByText("Use the dark theme"),
    ).toBeInTheDocument();
    expect(within(must(groups[1])).getByText("Home")).toBeInTheDocument();
  });

  it("runs an action a feature registered", async () => {
    const run = vi.fn();
    added.push(
      registerAction({
        id: "test.upload",
        label: "Upload PO",
        icon: Plus,
        keywords: ["purchase order", "new"],
        run,
      }),
    );
    open();
    await userEvent.type(await screen.findByRole("combobox"), "purchase");
    await userEvent.click(screen.getByRole("option", { name: /Upload PO/ }));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("hides an action the session has no permission for", async () => {
    added.push(
      registerAction({
        id: "test.roles",
        label: "Change a role",
        icon: Plus,
        permission: "roles.manage",
        run: () => undefined,
      }),
    );
    const { unmount } = open("SUPPORT");
    await screen.findByRole("combobox");
    expect(screen.queryByRole("option", { name: /Change a role/ })).toBeNull();
    unmount();
    open("SYSTEM_ADMIN");
    expect(
      await screen.findByRole("option", { name: /Change a role/ }),
    ).toBeInTheDocument();
  });

  it("explains the keys in its help", async () => {
    open();
    const help = await screen.findByRole("list", {
      name: "Keyboard shortcuts",
    });
    expect(help).toHaveTextContent("search this list");
    expect(help).toHaveTextContent("start a new record");
  });
});
