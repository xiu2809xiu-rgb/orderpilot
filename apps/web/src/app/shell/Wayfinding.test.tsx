import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { allFeatures } from "@/features/registry";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { renderApp } from "@/test/render";

beforeAll(async () => {
  await i18n.loadNamespaces([
    "common",
    "components",
    "directions-spark",
    "directions-parts",
    ...allFeatures.map((feature) => feature.namespace),
  ]);
});

async function open(
  role: Parameters<typeof sessionFor>[0] = "SUPPORT",
  demoMode = true,
) {
  const view = renderApp("/settings", {
    session: sessionFor(role),
    demoMode,
  });
  await screen.findByRole("heading", { level: 1, name: "Settings" });
  return view;
}

/** Waits for the tooltip's code, which is added beside a button of the bar once it arrives. */
async function barButton(name: string, role: "link" | "button") {
  await waitFor(() => {
    expect(
      screen
        .getByRole(role, { name })
        .parentElement?.querySelector("[data-slot=tooltip-trigger]"),
    ).toBeTruthy();
  });
  return screen.getByRole(role, { name });
}

describe("the synthetic demo data mark", () => {
  it("shows once, in the shell, while demo mode is on", async () => {
    await open();
    const mark = await screen.findByTestId("demo-mark");
    expect(mark).toHaveTextContent("Synthetic demo data");
    expect(screen.getAllByText("Synthetic demo data")).toHaveLength(1);
    // It has a strip of its own: it is not inside the page and holds no control.
    expect(mark.closest("main")).toBeNull();
    expect(within(mark).queryByRole("button")).toBeNull();
    expect(within(mark).queryByRole("link")).toBeNull();
  });

  it("is not there when the API says demo mode is off", async () => {
    await open("SUPPORT", false);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Spark" })).toBeVisible();
    });
    expect(screen.queryByTestId("demo-mark")).toBeNull();
  });
});

describe("what Upload and Spark do", () => {
  it("describes Upload before it is pressed, to assistive technology", async () => {
    await open();
    const upload = await barButton("Upload", "link");
    expect(upload).toHaveAccessibleDescription(
      "Demo: let Spark read a sample PO",
    );
    expect(upload).toHaveAttribute("href", "/upload");
  });

  it("describes Spark, and keeps what says it opens a panel", async () => {
    await open();
    const spark = await barButton("Spark", "button");
    expect(spark).toHaveAccessibleDescription(
      "Demo: ask Spark about stock or sales",
    );
    expect(spark).toHaveAttribute("aria-expanded", "false");
    expect(spark).toHaveAttribute("aria-controls");
  });

  it("shows the words in a tooltip on keyboard focus", async () => {
    await open();
    const upload = await barButton("Upload", "link");
    act(() => {
      upload.focus();
    });
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Demo: let Spark read a sample PO",
    );
  });

  it("shows the words in a tooltip when the pointer rests on Spark", async () => {
    const user = userEvent.setup();
    await open();
    await user.hover(await barButton("Spark", "button"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Demo: ask Spark about stock or sales",
    );
  });

  it("has no accessibility violations in the bar", async () => {
    await open();
    await barButton("Upload", "link");
    const bar = screen
      .getByRole("navigation", { name: "Breadcrumb" })
      .closest("header");
    expect(bar).not.toBeNull();
    expect(await axeViolations(bar ?? document.body)).toEqual([]);
  });
});

describe("the menu of a narrow window", () => {
  it("holds Upload and the theme, with the words of the top bar", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );
    const menu = await screen.findByRole("dialog", { name: "Navigation" });
    const extras = within(menu).getByRole("group", {
      name: "Upload and theme",
    });
    expect(
      within(extras).getByRole("link", { name: "Upload" }),
    ).toHaveAttribute("href", "/upload");
    expect(
      within(extras).getByRole("switch", { name: "Light theme" }),
    ).toBeVisible();
  });

  it("has no Upload for a role that may not upload, and still the theme", async () => {
    const user = userEvent.setup();
    await open("MANAGEMENT");
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );
    const menu = await screen.findByRole("dialog", { name: "Navigation" });
    expect(within(menu).queryByRole("link", { name: "Upload" })).toBeNull();
    expect(
      within(menu).getByRole("switch", { name: "Light theme" }),
    ).toBeVisible();
  });

  it("changes the theme from the switch in the menu", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );
    const menu = await screen.findByRole("dialog", { name: "Navigation" });
    // On in the light theme: switching it off is Dark.
    const theme = within(menu).getByRole("switch", { name: "Light theme" });
    expect(theme).toHaveAttribute("aria-checked", "true");
    await user.click(theme);
    expect(document.documentElement).toHaveClass("dark");
    expect(theme).toHaveAttribute("aria-checked", "false");
  });

  it(
    "closes on Upload, which opens the upload page",
    { timeout: 30_000 },
    async () => {
      const user = userEvent.setup();
      await open();
      await user.click(
        screen.getByRole("button", { name: "Open navigation menu" }),
      );
      const menu = await screen.findByRole("dialog", { name: "Navigation" });
      await user.click(within(menu).getByRole("link", { name: "Upload" }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull();
      });
      // The route changed: the trail of the top bar now ends on the upload page.
      // The page itself is a lazy chunk and may still be on its way, which can
      // hide the shell for a moment, so the trail is read from the document.
      const trail = await screen.findByRole("navigation", {
        name: "Breadcrumb",
        hidden: true,
      });
      await waitFor(() => {
        expect(within(trail).getByText("Upload and review")).toHaveAttribute(
          "aria-current",
          "page",
        );
      });
    },
  );
});
