import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { KitForm, LABELS, renderInRouter, signInAs, VALID } from "./kitHarness";

beforeAll(async () => {
  await i18n.loadNamespaces("form");
});

beforeEach(() => {
  localStorage.clear();
  signInAs("SUPPORT");
});

const ELSEWHERE = <h1>{LABELS.form}</h1>;

function beforeUnloadIsHeld(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

async function go(
  router: { navigate: (to: string) => Promise<void> },
  to: string,
) {
  await act(async () => {
    await router.navigate(to);
  });
}

describe("leaving a form", () => {
  it("a clean form lets the route change and the tab close", async () => {
    const { router } = renderInRouter(<KitForm />, ELSEWHERE);
    await screen.findByRole("textbox", { name: LABELS.customerPo });
    expect(beforeUnloadIsHeld()).toBe(false);
    await go(router, "/elsewhere");
    expect(router.state.location.pathname).toBe("/elsewhere");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a dirty form asks first, and Keep editing stays", async () => {
    const user = userEvent.setup();
    const { router } = renderInRouter(<KitForm />, ELSEWHERE);
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.customerPo }),
      "CPO-6",
    );
    expect(beforeUnloadIsHeld()).toBe(true);

    await go(router, "/elsewhere");
    const dialog = await screen.findByRole("dialog", {
      name: "Leave without saving?",
    });
    expect(dialog).toHaveTextContent("They stay as a draft on this device");
    expect(await axeViolations(document.body)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.pathname).toBe("/");
    expect(
      screen.getByRole("textbox", { name: LABELS.customerPo }),
    ).toHaveValue("CPO-6");

    await go(router, "/elsewhere");
    await user.click(
      await screen.findByRole("button", { name: "Leave this page" }),
    );
    expect(router.state.location.pathname).toBe("/elsewhere");
  });

  it("a query string change on the same page passes", async () => {
    const user = userEvent.setup();
    const { router } = renderInRouter(<KitForm />, ELSEWHERE);
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.customerPo }),
      "CPO-7",
    );
    await go(router, "/?tab=lines");
    expect(router.state.location.search).toBe("?tab=lines");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("saving clears it, so a save that navigates is never asked", async () => {
    const user = userEvent.setup();
    const { router } = renderInRouter(<KitForm defaults={VALID} />, ELSEWHERE);
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.remarks }),
      "Fragile",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(beforeUnloadIsHeld()).toBe(false);
    });
    await go(router, "/elsewhere");
    expect(router.state.location.pathname).toBe("/elsewhere");
  });

  it("someone who just signed in over the form is not asked about its changes", async () => {
    const user = userEvent.setup();
    const { router } = renderInRouter(<KitForm />, ELSEWHERE);
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.customerPo }),
      "CPO-8",
    );
    act(() => {
      useSessionStore.getState().setSession(sessionFor("FINANCE"));
    });
    await go(router, "/elsewhere");
    expect(router.state.location.pathname).toBe("/elsewhere");
  });
});
