import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import * as RealMenu from "@/components/ui/dropdown-menu";
import { deferredModule, type DeferredModule } from "@/lib/deferred";
import { DeferredRoot, DeferredTrigger, deferredPart } from "./deferred";

type Menu = typeof RealMenu;

/** A menu whose chunk arrives only when the test says so. */
function slowMenu() {
  let arrive: () => void = () => undefined;
  const importer = vi.fn(
    () =>
      new Promise<Menu>((resolve) => {
        arrive = () => {
          resolve(RealMenu);
        };
      }),
  );
  const module = deferredModule(importer);
  return {
    module,
    importer,
    arrive: async () => {
      await act(async () => {
        const loading = module.load();
        arrive();
        await loading;
      });
    },
  };
}

/** The menu under test, built once per module as the shell's facades are. */
function menuFor(module: DeferredModule<Menu>) {
  const Content = deferredPart(module, (ui) => ui.DropdownMenuContent);
  const Item = deferredPart(module, (ui) => ui.DropdownMenuItem);
  return function TestMenu({
    open,
    onOpenChange,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) {
    return (
      <DeferredRoot
        module={module}
        open={open}
        onOpenChange={onOpenChange}
        render={(ui, props) => <ui.DropdownMenu {...props} />}
      >
        <DeferredTrigger
          module={module}
          popup="menu"
          slot="dropdown-menu-trigger"
          asChild
          render={(ui, props) => <ui.DropdownMenuTrigger {...props} />}
        >
          <Button variant="ghost" className="rounded-full">
            Account
          </Button>
        </DeferredTrigger>
        <Content>
          <Item>Sign out</Item>
        </Content>
      </DeferredRoot>
    );
  };
}

// The idle prefetch runs only when a test calls it, so each test decides
// when the chunk is fetched.
let idle: (() => void)[] = [];
beforeEach(() => {
  idle = [];
  vi.stubGlobal("requestIdleCallback", (task: () => void) => idle.push(task));
  vi.stubGlobal("cancelIdleCallback", () => undefined);
});

describe("deferred shell overlays", () => {
  it("shows a plain trigger that looks like the real one before the chunk arrives", async () => {
    const menu = slowMenu();
    const TestMenu = menuFor(menu.module);
    render(<TestMenu />);
    const standIn = screen.getByRole("button", { name: "Account" });
    expect(standIn).toHaveAttribute("aria-haspopup", "menu");
    expect(standIn).toHaveAttribute("aria-expanded", "false");
    expect(standIn).toHaveAttribute("type", "button");
    const classes = standIn.className;

    await menu.arrive();
    const real = screen.getByRole("button", { name: "Account" });
    expect(real).not.toBe(standIn);
    expect(real.className).toBe(classes);
    expect(real).toHaveAttribute("aria-haspopup", "menu");
  });

  it("opens the menu once it arrives when the stand-in was clicked", async () => {
    const user = userEvent.setup();
    const menu = slowMenu();
    const TestMenu = menuFor(menu.module);
    render(<TestMenu />);
    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(menu.importer).toHaveBeenCalledTimes(1);

    await menu.arrive();
    expect(
      await screen.findByRole("menuitem", { name: "Sign out" }),
    ).toBeVisible();
  });

  it("asks a controlled owner to open", async () => {
    const user = userEvent.setup();
    const menu = slowMenu();
    const changes: boolean[] = [];
    const TestMenu = menuFor(menu.module);
    function Owner() {
      const [open, setOpen] = useState(false);
      return (
        <TestMenu
          open={open}
          onOpenChange={(next) => {
            changes.push(next);
            setOpen(next);
          }}
        />
      );
    }
    render(<Owner />);
    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(changes).toEqual([true]);
    await menu.arrive();
    expect(await screen.findByRole("menu")).toBeVisible();
  });

  it("hands focus to the real trigger when the chunk arrives", async () => {
    const user = userEvent.setup();
    const menu = slowMenu();
    const TestMenu = menuFor(menu.module);
    render(<TestMenu />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Account" })).toHaveFocus();
    // Focus starts the fetch, ahead of any click.
    expect(menu.importer).toHaveBeenCalledTimes(1);

    await menu.arrive();
    expect(screen.getByRole("button", { name: "Account" })).toHaveFocus();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("prefetches the chunk once the browser is idle", async () => {
    const menu = slowMenu();
    const TestMenu = menuFor(menu.module);
    render(<TestMenu />);
    expect(menu.importer).not.toHaveBeenCalled();
    for (const task of idle) task();
    expect(menu.importer).toHaveBeenCalledTimes(1);
    await menu.arrive();
    expect(screen.getByRole("button", { name: "Account" })).toHaveAttribute(
      "data-slot",
      "dropdown-menu-trigger",
    );
  });

  it("opens from the keyboard after the chunk arrives", async () => {
    const user = userEvent.setup();
    const menu = slowMenu();
    const TestMenu = menuFor(menu.module);
    render(<TestMenu />);
    await menu.arrive();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("menuitem", { name: "Sign out" }),
    ).toBeVisible();
  });

  it("fetches again on the next click when a fetch failed", async () => {
    const user = userEvent.setup();
    let online = false;
    const importer = vi.fn(() =>
      online ? Promise.resolve(RealMenu) : Promise.reject(new Error("offline")),
    );
    const TestMenu = menuFor(deferredModule(importer));
    render(<TestMenu />);
    await user.click(screen.getByRole("button", { name: "Account" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    online = true;
    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(await screen.findByRole("menu")).toBeVisible();
  });
});
