import type { Page } from "@playwright/test";

/** The name the init script reports CSP violations to. */
export const CSP_BINDING = "__orderpilotCspViolation";

const watched = new WeakMap<Page, string[]>();

// Chromium logs every failed request as a console error too. Responses are
// judged on their own below, so these lines would only count them twice.
const RESOURCE_STATUS = "Failed to load resource: the server responded";

/**
 * Starts collecting what a person would call broken: console errors, uncaught
 * errors, CSP violations, any response of 500 or more, and a 403 from the API,
 * which means the page asked for something its role cannot read. The test
 * fixture calls this for every page; `checkPage` reads the list.
 */
export async function watchPage(page: Page): Promise<void> {
  const problems: string[] = [];
  watched.set(page, problems);
  await page.exposeBinding(CSP_BINDING, (_source, text: unknown) => {
    problems.push(`CSP violation: ${String(text)}`);
  });
  page.on("console", (message) => {
    if (
      message.type() !== "error" ||
      message.text().startsWith(RESOURCE_STATUS)
    ) {
      return;
    }
    problems.push(`console error: ${message.text().slice(0, 300)}`);
  });
  page.on("pageerror", (error) => {
    problems.push(`uncaught error: ${error.message.slice(0, 300)}`);
  });
  page.on("response", (response) => {
    const status = response.status();
    const { pathname } = new URL(response.url());
    const method = response.request().method();
    if (status >= 500) {
      problems.push(`${String(status)} from ${method} ${pathname}`);
    } else if (status === 403 && pathname.startsWith("/api/")) {
      problems.push(
        `403 from ${method} ${pathname}: the page asked for something its role cannot read`,
      );
    }
  });
}

/** Everything collected since the last call, emptying the list. */
export function takeProblems(page: Page): string[] {
  const problems = watched.get(page);
  if (!problems) {
    throw new Error(
      'This page is not watched. Import `test` from "../src/index.js", not from "@playwright/test".',
    );
  }
  return problems.splice(0);
}
