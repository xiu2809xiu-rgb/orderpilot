import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { HttpResponse, http } from "msw";
import { beforeAll, describe, expect, it } from "vitest";
import { createQueryClient } from "@/lib/query";
import { server } from "@/test/server";
import { SystemHealth } from "./SystemHealth";

const STATUS = "*/api/v1/system/checks/status";

function renderCard() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <SystemHealth />
    </QueryClientProvider>,
  );
}

describe("SystemHealth", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces("home");
  });

  it("names each service in words and says it answered", async () => {
    server.use(
      http.get(STATUS, () =>
        HttpResponse.json({
          data: [
            { name: "database", status: "up", durationMs: 3 },
            { name: "redis", status: "up", durationMs: 4 },
          ],
        }),
      ),
    );
    renderCard();
    expect(await screen.findByText("Database")).toBeVisible();
    expect(screen.getByText("Cache and job queue")).toBeVisible();
    expect(screen.getByText("Up, 3 ms")).toBeVisible();
    expect(screen.getByText("Every service answered just now.")).toBeVisible();
  });

  it("says how many are down, and checks again when asked", async () => {
    let calls = 0;
    server.use(
      http.get(STATUS, () => {
        calls += 1;
        return HttpResponse.json({
          data: [
            { name: "database", status: "up", durationMs: 3 },
            { name: "storage", status: "down", durationMs: 2000 },
          ],
        });
      }),
    );
    renderCard();
    expect(await screen.findByText("Down")).toBeVisible();
    // Red, not green: the words and the colour must agree.
    expect(screen.getByText("Down").closest("[data-tone]")).toHaveAttribute(
      "data-tone",
      "danger",
    );
    expect(
      screen.getByText(
        "1 service did not answer. Its reason is in the server log.",
      ),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Check again" }));
    await screen.findByText("Down");
    expect(calls).toBe(2);
  });
});
