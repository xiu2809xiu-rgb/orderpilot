import AxeBuilder from "@axe-core/playwright";
import { type Browser, type Locator, type Page } from "@playwright/test";
import {
  DEMO_PERSONAS,
  myAvailabilityResponseSchema,
  type Role,
} from "@orderpilot/shared";
import {
  BASE_URL,
  callAs,
  checkPage,
  expect,
  test,
  WCAG_TAGS,
} from "../src/index.js";
import { sessionFor, type StoredSession } from "../src/session.js";

// Availability on the avatar (story C, ADR 0070). Base accounts only: the nine
// demo personas that every stack has. SUPPORT sets it and PRODUCT_MANAGER
// looks. Setting it changes no rule, so the other specs that use these two
// roles are not affected. The spec puts SUPPORT back to Available before it
// starts and after it ends, even when a test fails. A run killed in between
// leaves a choice for at most 12 hours and harms nothing. It makes a handful of
// writes: the stack's one shared address allows 30 a minute.

const SETTER = "SUPPORT" satisfies Role;
const LOOKER = "PRODUCT_MANAGER" satisfies Role;
const PERSONA = DEMO_PERSONAS[SETTER];

const held = new Map<Role, StoredSession>();

function sessionOf(role: Role): StoredSession {
  const session = held.get(role);
  if (!session) throw new Error(`The spec holds no session for ${role}.`);
  return session;
}

const call = (
  role: Role,
  method: Parameters<typeof callAs>[1],
  route: string,
  body?: unknown,
) => callAs(role, method, route, body, sessionOf(role));

async function putBack(): Promise<void> {
  const { status } = await call(SETTER, "PUT", "/availability/mine", {
    value: "AVAILABLE",
  });
  expect(status, "SUPPORT is put back to Available").toBe(200);
}

async function signIn(page: Page, role: Role): Promise<void> {
  await page.context().addCookies(sessionOf(role).cookies);
}

/** A second browser context signed in as another account, for the colleague's view. */
async function asLooker(browser: Browser) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: sessionOf(LOOKER),
  });
  return { context, page: await context.newPage() };
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  for (const role of [SETTER, LOOKER] satisfies Role[]) {
    held.set(role, await sessionFor(role));
  }
  await putBack();
});

test.afterAll(async () => {
  await putBack();
});

const dot = (page: Page, value = "Available"): Locator =>
  page.getByRole("button", { name: `Your availability: ${value}. Change` });
const pill = (page: Page): Locator =>
  page.getByRole("menu", { name: "Your availability" });
const choice = (page: Page, name: string): Locator =>
  pill(page).getByRole("menuitemradio", { name });

/**
 * A press on a choice counts once the pill has been in the page for a quarter
 * of a second (the second click of a double click would otherwise land on the
 * first choice), which no hand is faster than and a script is.
 */
async function pickByMouse(page: Page, name: string): Promise<void> {
  await expect(pill(page)).toBeVisible();
  await page.waitForTimeout(300);
  await choice(page, name).click();
}

/** The pill lies inside the viewport with room to spare. */
async function expectInsideViewport(page: Page, spare = 8): Promise<void> {
  // Radix draws the menu off screen (a box at y below zero) until it has
  // measured the anchor, a frame or more after it appears: wait for a place,
  // then for two reads, a frame apart, to agree.
  await expect
    .poll(async () => (await pill(page).boundingBox())?.y ?? -1, {
      message: "the menu is placed",
    })
    .toBeGreaterThanOrEqual(0);
  let box = await pill(page).boundingBox();
  for (let tries = 0; tries < 20; tries += 1) {
    await page.waitForTimeout(50);
    const next = await pill(page).boundingBox();
    const same = JSON.stringify(next) === JSON.stringify(box);
    box = next;
    if (same) break;
  }
  const view = page.viewportSize();
  expect(box, "the pill has a box").not.toBeNull();
  expect(view, "the page has a viewport").not.toBeNull();
  if (!box || !view) return;
  expect(box.x).toBeGreaterThanOrEqual(spare - 0.5);
  expect(box.y).toBeGreaterThanOrEqual(spare - 0.5);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width - spare + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height - spare + 0.5);
}

test("a person sets their availability from the avatar and it survives a reload", async ({
  page,
}) => {
  await signIn(page, SETTER);
  await page.goto("/");
  await dot(page).click();
  await expect(pill(page)).toBeVisible();
  await expect(pill(page).getByRole("menuitemradio")).toHaveCount(3);
  await pickByMouse(page, "Do not disturb");
  await expect(
    page.getByText(
      "Do not disturb for 12 hours. Reminders and approvals still reach you.",
    ),
  ).toBeVisible();
  await expect(dot(page, "Do not disturb")).toBeVisible();
  await page.reload();
  await expect(dot(page, "Do not disturb")).toBeVisible();
  const { body } = await call(SETTER, "GET", "/availability/mine");
  expect(myAvailabilityResponseSchema.parse(body).data.value).toBe(
    "DO_NOT_DISTURB",
  );
});

test("a colleague sees it in the Demo role menu", async ({ browser }) => {
  const { context, page } = await asLooker(browser);
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Demo role" }).click();
    const row = page.getByRole("menuitem", { name: new RegExp(PERSONA) });
    await expect(row).toContainText("Do not disturb");
  } finally {
    await context.close();
  }
});

test("it is set back, and the colleague sees no words on that row", async ({
  page,
  browser,
}) => {
  await signIn(page, SETTER);
  await page.goto("/");
  await dot(page, "Do not disturb").click();
  await pickByMouse(page, "Available");
  await expect(dot(page)).toBeVisible();
  const { context, page: other } = await asLooker(browser);
  try {
    await other.goto("/");
    await other.getByRole("button", { name: "Demo role" }).click();
    const row = other.getByRole("menuitem", { name: new RegExp(PERSONA) });
    await expect(row).toBeVisible();
    await expect(row).not.toContainText("Do not disturb");
    await expect(row).not.toContainText("Focusing");
  } finally {
    await context.close();
  }
});

test("the keyboard walk: Tab to the button, Enter, ArrowRight, Enter", async ({
  page,
}) => {
  await signIn(page, SETTER);
  await page.goto("/");
  const button = dot(page);
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(pill(page)).toBeVisible();
  await expect(choice(page, "Available")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(choice(page, "Focusing")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dot(page, "Focusing")).toBeFocused();
  await putBack();
});

test("a press and a release of the mouse on the ring or the dot opens the menu and picks nothing", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await signIn(page, SETTER);
  // A value that a stray pick of the first choice would change.
  expect(
    (
      await call(SETTER, "PUT", "/availability/mine", {
        value: "DO_NOT_DISTURB",
      })
    ).status,
  ).toBe(200);
  const puts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().includes("/availability")) {
      puts.push(request.url());
    }
  });
  try {
    for (const [route, trigger] of [
      [
        "/settings?section=account",
        page.locator('.ap-trigger[data-skin="ring"]'),
      ],
      ["/", page.locator(".dx-person-dot")],
    ] as const) {
      await page.goto(route);
      await expect(trigger).toBeVisible();
      const box = await trigger.boundingBox();
      expect(box, "the control has a box").not.toBeNull();
      if (!box) return;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      // A real click: the pill opens on the press and the release comes
      // while it is still growing, over whatever it has grown under the pointer.
      await page.mouse.down();
      await page.waitForTimeout(120);
      await page.mouse.up();
      await expect(
        pill(page),
        `the menu stays open from ${route}`,
      ).toBeVisible();
      await expect(pill(page)).toHaveAttribute("data-settled", "");
      await expect(pill(page).getByRole("menuitemradio")).toHaveCount(3);
      const { body } = await call(SETTER, "GET", "/availability/mine");
      expect(myAvailabilityResponseSchema.parse(body).data.value).toBe(
        "DO_NOT_DISTURB",
      );
      expect(puts, `no change is sent from ${route}`).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(pill(page)).toHaveCount(0);
    }
  } finally {
    await putBack();
  }
});

test("a double click on the ring opens the menu and picks nothing", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await signIn(page, SETTER);
  expect(
    (
      await call(SETTER, "PUT", "/availability/mine", {
        value: "DO_NOT_DISTURB",
      })
    ).status,
  ).toBe(200);
  try {
    await page.goto("/settings?section=account");
    const ring = page.locator('.ap-trigger[data-skin="ring"]');
    await expect(ring).toBeVisible();
    const box = await ring.boundingBox();
    expect(box, "the ring has a box").not.toBeNull();
    if (!box) return;
    // The pill opens over the ring, so the second click lands on its first choice.
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2, {
      delay: 40,
    });
    await page.waitForTimeout(900);
    const { body } = await call(SETTER, "GET", "/availability/mine");
    expect(myAvailabilityResponseSchema.parse(body).data.value).toBe(
      "DO_NOT_DISTURB",
    );
  } finally {
    await putBack();
  }
});

test("the caption follows the choice", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await signIn(page, SETTER);
  await page.goto("/");
  // By the keyboard, so that focus starts on the checked choice: a mouse that
  // opens the menu leaves focus on the menu itself once the pill has grown out
  // from under the pointer, and ArrowRight would then start from the first.
  await dot(page).focus();
  await page.keyboard.press("Enter");
  await expect(pill(page)).toBeVisible();
  // The pill is drawn scaled while it grows: measure it after the growth.
  await expect(pill(page)).toHaveAttribute("data-settled", "");
  const chip = pill(page).locator(".ap-chip");
  await expect(chip).toBeVisible();
  const centreOf = async (target: Locator): Promise<number> => {
    const box = await target.boundingBox();
    return box ? box.x + box.width / 2 : Number.NaN;
  };
  // The first caption is held 4 px inside the pill, so it is not centred under
  // the first choice; the second is, and that is where it must arrive.
  await page.keyboard.press("ArrowRight");
  await expect(choice(page, "Focusing")).toBeFocused();
  // The caption glides on a spring: it arrives under the second choice.
  await expect
    .poll(
      async () =>
        Math.abs(
          (await centreOf(chip)) - (await centreOf(choice(page, "Focusing"))),
        ),
      { timeout: 3_000 },
    )
    .toBeLessThan(3);
  await expect(chip).toHaveText("Focusing");
});

test("reduced motion removes the pill's animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, SETTER);
  await page.goto("/");
  await dot(page).click();
  await expect(pill(page)).toBeVisible();
  await expect(pill(page)).toHaveCSS("animation-name", "none");
  await page.keyboard.press("Escape");
});

test("the pill is never clipped, with the panel open and in the rail", async ({
  page,
}) => {
  await signIn(page, SETTER);
  await page.goto("/");
  await dot(page).click();
  await expect(pill(page)).toBeVisible();
  await expectInsideViewport(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Collapse the panel" }).click();
  await dot(page).click();
  await expect(pill(page)).toBeVisible();
  await expectInsideViewport(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Expand the panel" }).click();
});

test("the pages pass the accessibility check, and so does the open menu in light and dark", async ({
  page,
}) => {
  await signIn(page, SETTER);
  await page.goto("/settings?section=account");
  await checkPage(page);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");
    await dot(page).click();
    await expect(pill(page)).toBeVisible();
    // The pill's glass is switched on after its growth: wait for that, so the
    // contrast of the words on it is measured as a person sees it.
    await expect(pill(page))
      .toHaveAttribute("data-settled", "", {
        timeout: 2_000,
      })
      .catch(() => undefined);
    // Radix hides the page behind any open menu with aria-hidden while its
    // buttons stay focusable, and axe flags that for the account menu too:
    // it is the menu library's way of holding focus, not this story's.
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .disableRules(["aria-hidden-focus"])
      .analyze();
    expect(
      violations.map((v) => `${v.id}: ${v.help}`),
      `axe with the menu open in ${scheme}`,
    ).toEqual([]);
    await page.keyboard.press("Escape");
  }
});

test.describe("on a phone with a touch screen", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("the control and every item are touch targets of 44 px, and the words sit under the orbs", async ({
    page,
  }) => {
    await signIn(page, SETTER);
    await page.goto("/");
    expect(
      await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
      "touch emulation gives a coarse pointer",
    ).toBe(true);
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const button = dot(page);
    await expect(button).toBeVisible();
    // Read by polling: the shell swaps its stand-in button for the real one
    // once the menu's code has arrived, and a read in between finds no box.
    await expect
      .poll(async () => (await button.boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(43.5);
    await expect
      .poll(async () => (await button.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(43.5);
    await button.tap();
    await expect(pill(page)).toBeVisible();
    for (const item of await pill(page).getByRole("menuitemradio").all()) {
      const itemBox = await item.boundingBox();
      expect(itemBox?.height).toBeGreaterThanOrEqual(43.5);
      expect(itemBox?.width).toBeGreaterThanOrEqual(43.5);
    }
    // The words are drawn under the orbs on a touch screen.
    // (The hidden measuring copy of each word is not the one that is drawn.)
    const label = choice(page, "Do not disturb").locator(".ap-label");
    await expect(label).toBeVisible();
    const orbBox = await choice(page, "Do not disturb")
      .locator(".ap-orb")
      .boundingBox();
    const labelBox = await label.boundingBox();
    expect(labelBox?.y ?? 0).toBeGreaterThanOrEqual(
      (orbBox?.y ?? 0) + (orbBox?.height ?? 0) - 0.5,
    );
    await expectInsideViewport(page);
  });

  test("a finger on the dot in the phone menu or on the ring in Settings opens the menu and picks nothing", async ({
    page,
  }) => {
    // A tap is followed by a click, and the pill has grown under the finger:
    // that click must not pick the choice it lands on. A value that a stray
    // pick would change.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await signIn(page, SETTER);
    expect(
      (
        await call(SETTER, "PUT", "/availability/mine", {
          value: "DO_NOT_DISTURB",
        })
      ).status,
    ).toBe(200);
    const puts: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "PUT" &&
        request.url().includes("/availability")
      ) {
        puts.push(request.url());
      }
    });
    const tapCentre = async (target: Locator): Promise<void> => {
      // The phone menu slides in: tap where the control has come to rest.
      let box = await target.boundingBox();
      for (let tries = 0; tries < 20; tries += 1) {
        await page.waitForTimeout(100);
        const next = await target.boundingBox();
        const same = JSON.stringify(next) === JSON.stringify(box);
        box = next;
        if (same) break;
      }
      expect(box, "the control has a box").not.toBeNull();
      if (!box) return;
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    };
    try {
      await page.goto("/");
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      await expect(dot(page, "Do not disturb")).toBeVisible();
      await tapCentre(dot(page, "Do not disturb"));
      await expect(pill(page)).toBeVisible();
      await expect(pill(page)).toHaveAttribute("data-settled", "");
      await page.waitForTimeout(400);
      await expect(
        pill(page),
        "the phone menu's pill stays open",
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(pill(page)).toHaveCount(0);

      await page.goto("/settings?section=account");
      const ring = page.locator('.ap-trigger[data-skin="ring"]');
      await expect(ring).toBeVisible();
      await tapCentre(ring);
      await expect(pill(page)).toBeVisible();
      await expect(pill(page)).toHaveAttribute("data-settled", "");
      await page.waitForTimeout(400);
      await expect(pill(page), "the ring's pill stays open").toBeVisible();
      const { body } = await call(SETTER, "GET", "/availability/mine");
      expect(myAvailabilityResponseSchema.parse(body).data.value).toBe(
        "DO_NOT_DISTURB",
      );
      expect(puts, "a tap sends no change").toEqual([]);
    } finally {
      await putBack();
    }
  });

  test("a tap on the avatar's centre opens the account menu, not availability", async ({
    page,
  }) => {
    await signIn(page, SETTER);
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const avatar = page
      .getByRole("button", { name: /^Account menu/ })
      .locator('[data-slot="avatar"]');
    const box = await avatar.boundingBox();
    expect(box, "the avatar has a box").not.toBeNull();
    if (!box) return;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(
      page.getByRole("menuitem", { name: "Sign out" }),
    ).toBeVisible();
    await expect(pill(page)).toHaveCount(0);
  });
});

test.describe("on the narrowest screen", () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 640 } });

  test("the pill stays inside the screen from the phone menu and from Settings, also when opened by the button with the ring off screen", async ({
    page,
  }) => {
    await signIn(page, SETTER);
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await dot(page).tap();
    await expect(pill(page)).toBeVisible();
    await expectInsideViewport(page);
    await page.keyboard.press("Escape");
    await page.reload();

    await page.goto("/settings?section=account");
    const change = page.getByRole("button", { name: "Change availability" });
    await expect(change).toBeVisible();
    // Scroll so that the ring starts off screen: the button scrolls it back.
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await change.scrollIntoViewIfNeeded();
    await change.tap();
    await expect(pill(page)).toBeVisible();
    await expectInsideViewport(page);
    await page.keyboard.press("Escape");
    await expect(change).toBeFocused();
  });
});

test.describe("on a tablet with a touch screen", () => {
  test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });

  test("a tap on the avatar's centre opens the account menu, in the open panel and in the 64 px rail", async ({
    page,
  }) => {
    await signIn(page, SETTER);
    await page.goto("/");
    expect(
      await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
      "touch emulation gives a coarse pointer",
    ).toBe(true);
    const avatar = page
      .getByRole("button", { name: /^Account menu/ })
      .locator('[data-slot="avatar"]');
    const tapAvatar = async (where: string): Promise<void> => {
      const box = await avatar.boundingBox();
      expect(box, `the avatar has a box ${where}`).not.toBeNull();
      if (!box) return;
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await expect(
        page.getByRole("menuitem", { name: "Sign out" }),
        `the account menu opens ${where}`,
      ).toBeVisible();
      await expect(pill(page)).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("menuitem", { name: "Sign out" }),
      ).toHaveCount(0);
    };
    await tapAvatar("in the open panel");
    await page.getByRole("button", { name: "Collapse the panel" }).click();
    await tapAvatar("in the rail");
    await page.getByRole("button", { name: "Expand the panel" }).click();
  });
});
