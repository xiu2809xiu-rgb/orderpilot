import { request, type Page } from "@playwright/test";
import {
  HEADERS,
  myPictureResponseSchema,
  type MyPicture,
  type Role,
} from "@orderpilot/shared";
import {
  apiUrl,
  callAs,
  checkPage,
  expect,
  expectRefused,
  signInAs,
  test,
} from "../src/index.js";
import { flatPng } from "../src/flat-png.js";
import { ORIGIN } from "../src/env.js";
import { csrfToken, sessionFor } from "../src/session.js";

// Profile pictures a person approves (story B). Base accounts only: the nine
// demo personas that every stack has. The picture is a flat colour made in
// this file. Each run sends at most one picture per account, because the API
// allows ten uploads in 24 hours, and every picture is taken back at the end,
// even when a test fails, so the next run starts clean.

const OWNER = "PRODUCT_MANAGER" satisfies Role;
const ADMIN = "SYSTEM_ADMIN" satisfies Role;
const SOURCE = flatPng(320, 200, [34, 139, 120]);

test.describe.configure({ mode: "serial" });

async function mine(role: Role): Promise<MyPicture> {
  const { status, body } = await callAs(role, "GET", "/profile-pictures/mine");
  expect(status, `${role} reads their pictures`).toBe(200);
  return myPictureResponseSchema.parse(body).data;
}

/** Takes back whatever the account has waiting or approved. */
async function takeBack(role: Role): Promise<void> {
  const picture = await mine(role);
  for (const live of [picture.pending, picture.approved]) {
    if (!live) continue;
    const { status } = await callAs(
      role,
      "POST",
      `/profile-pictures/${live.id}/withdraw`,
    );
    expect(status, `${role} takes back ${live.id}`).toBe(200);
  }
}

/** Chooses the flat picture on the account card and sends it for review. */
async function sendPicture(page: Page): Promise<void> {
  await page.goto("/settings?section=account");
  await page.locator('input[type="file"]').setInputFiles({
    name: "flat-colour.png",
    mimeType: "image/png",
    buffer: SOURCE,
  });
  await expect(
    page.getByRole("heading", { name: "This is what the reviewer will see" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(
    page.getByText("Waiting for review", { exact: true }),
  ).toBeVisible();
}

/** The id of the picture an account has waiting, which the spec reads from the API. */
async function pendingId(role: Role): Promise<string> {
  const id = (await mine(role)).pending?.id;
  expect(id, `${role} has a picture waiting`).toBeDefined();
  return id ?? "";
}

test.beforeAll(async () => {
  await takeBack(OWNER);
  await takeBack(ADMIN);
});

test.afterAll(async () => {
  await takeBack(OWNER);
  await takeBack(ADMIN);
});

test("a file that is not a picture is refused in plain words", async ({
  page,
}) => {
  await signInAs(page, OWNER);
  await page.goto("/settings?section=account");
  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.png",
    mimeType: "image/png",
    buffer: Buffer.from("This is a note, not a picture."),
  });
  await expect(
    page.getByText("This file could not be read as a picture."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send for review" }),
  ).toHaveCount(0);
});

test("a person sends a picture and it waits for review, shown to nobody else", async ({
  page,
}) => {
  await signInAs(page, OWNER);
  await sendPicture(page);
  await expect(
    page.getByText(
      "Only you and the reviewers can see this picture until a reviewer approves it.",
    ),
  ).toBeVisible();
  // The menu keeps the initials until a reviewer approves.
  await expect(
    page.getByRole("button", { name: "Account menu" }).locator("img"),
  ).toHaveCount(0);

  const id = await pendingId(OWNER);
  // A 404, not a 403: a person who may not see it is not told that it exists.
  const other = await callAs("SUPPORT", "GET", `/profile-pictures/${id}/image`);
  expect(other.status).toBe(404);
  const owner = await callAs(OWNER, "GET", `/profile-pictures/${id}/image`);
  expect(owner.status).toBe(200);
});

test("a reviewer sees the waiting picture and the pages pass the accessibility check", async ({
  page,
}) => {
  await signInAs(page, ADMIN);
  await page.goto("/settings?section=pictures");
  const id = await pendingId(OWNER);
  const row = page.locator("li", {
    has: page.locator(`img[src$="/profile-pictures/${id}/image"]`),
  });
  await expect(row).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Settings sections" })
      .getByRole("link", { name: /^Profile pictures\s*\d+\s*waiting$/ }),
  ).toBeVisible();
  await expect(
    row.getByRole("button", { name: /^Approve picture/ }),
  ).toBeVisible();
  await checkPage(page);

  await page.goto("/settings?section=account");
  await checkPage(page);
});

test("a reviewer approves it and it shows in the owner's side menu", async ({
  page,
  browser,
}) => {
  const id = await pendingId(OWNER);
  await signInAs(page, ADMIN);
  await page.goto("/settings?section=pictures");
  const row = page.locator("li", {
    has: page.locator(`img[src$="/profile-pictures/${id}/image"]`),
  });
  await row.getByRole("button", { name: /^Approve picture/ }).click();
  await expect(row).toHaveCount(0);

  const context = await browser.newContext();
  try {
    const ownerPage = await context.newPage();
    await context.addCookies((await sessionFor(OWNER)).cookies);
    await ownerPage.goto("/");
    const avatar = ownerPage
      .getByRole("button", { name: "Account menu" })
      .locator("img");
    await expect(avatar).toHaveAttribute(
      "src",
      new RegExp(`/profile-pictures/${id}/image$`),
    );
    // Chromium's own JPEG passed the server's cleaner, and the server's copy loads.
    await expect
      .poll(() => avatar.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(256);
  } finally {
    await context.close();
  }
});

test("an administrator cannot review their own picture, and the refusal carries its trace id", async ({
  page,
}) => {
  await signInAs(page, ADMIN);
  await sendPicture(page);
  await expect(
    page.getByText(
      "You may review pictures, but not your own. Another administrator has to review this one.",
    ),
  ).toBeVisible();
  const id = await pendingId(ADMIN);
  const traceId = await expectRefused(
    ADMIN,
    "POST",
    `/profile-pictures/${id}/approve`,
  );
  expect(traceId).toMatch(/^e2e-/);
});

test("a picture sent as anything but a JPEG is refused with its code", async () => {
  const session = await sessionFor(OWNER);
  const api = await request.newContext({ storageState: session });
  try {
    const res = await api.fetch(apiUrl("/profile-pictures/mine"), {
      method: "PUT",
      data: SOURCE,
      headers: {
        Origin: ORIGIN,
        [HEADERS.csrf]: csrfToken(session),
        "Content-Type": "image/png",
      },
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as {
      error: { details: { message: string }[] };
    };
    expect(body.error.details[0]?.message).toBe("wrong_type");
  } finally {
    await api.dispose();
  }
});
