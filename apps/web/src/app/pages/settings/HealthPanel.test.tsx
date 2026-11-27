import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeAll, describe, expect, it } from "vitest";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";
import { HealthPanel } from "./HealthPanel";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";
import { summariseHealth } from "./useServiceHealth";

beforeAll(loadSettingsWords);

const STATUS = "*/api/v1/system/checks/status";

const UP = [
  { name: "database", status: "up", durationMs: 3 },
  { name: "redis", status: "up", durationMs: 4 },
  { name: "storage", status: "up", durationMs: 9 },
];

const details = () => document.querySelector("details");

describe("summariseHealth", () => {
  it("lists the services that did not answer", () => {
    const checks = [
      { name: "database", status: "up", durationMs: 3 },
      { name: "redis", status: "down", durationMs: 0 },
    ] as const;
    const summary = summariseHealth(checks);
    expect(summary.allUp).toBe(false);
    expect(summary.down.map((check) => check.name)).toEqual(["redis"]);
    expect(summariseHealth([checks[0]]).allUp).toBe(true);
  });
});

describe("the system health section", () => {
  it("says everything is working, and when it was checked, with the services behind Show details", async () => {
    server.use(http.get(STATUS, () => HttpResponse.json({ data: UP })));
    renderSettings(<HealthPanel />, { role: "SYSTEM_ADMIN" });
    expect(await screen.findByText("Everything is working")).toBeVisible();
    expect(
      screen.getByText(/^Last checked at .* Singapore time\.$/),
    ).toBeVisible();
    expect(details()?.open).toBe(false);
    await userEvent.click(screen.getByText("Show details"));
    expect(details()?.open).toBe(true);
    expect(screen.getByText("Database")).toBeVisible();
    expect(screen.getByText("Cache and job queue")).toBeVisible();
    expect(screen.getByText("Document storage")).toBeVisible();
    expect(screen.getByText("Up, 3 ms")).toBeVisible();
  });

  it("names how many services are down, opens the details, and says what it affects", async () => {
    server.use(
      http.get(STATUS, () =>
        HttpResponse.json({
          data: [
            UP[0],
            { name: "redis", status: "down", durationMs: 0 },
            UP[2],
          ],
        }),
      ),
    );
    renderSettings(<HealthPanel />, { role: "SYSTEM_ADMIN" });
    expect(await screen.findByText("1 service is not answering")).toBeVisible();
    expect(details()?.open).toBe(true);
    expect(screen.getByText("Down")).toBeVisible();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Background jobs, such as reading uploaded documents, are delayed.",
    );
    expect(alert).not.toHaveTextContent("Orders and documents cannot be saved");
    expect(
      screen.getByText("The reason for a failure is in the server log."),
    ).toBeVisible();
  });

  it("uses the plural for more than one", async () => {
    server.use(
      http.get(STATUS, () =>
        HttpResponse.json({
          data: UP.map((check) => ({ ...check, status: "down" })),
        }),
      ),
    );
    renderSettings(<HealthPanel />, { role: "SYSTEM_ADMIN" });
    expect(
      await screen.findByText("3 services are not answering"),
    ).toBeVisible();
  });

  it("asks again on Check again", async () => {
    let calls = 0;
    server.use(
      http.get(STATUS, () => {
        calls += 1;
        return HttpResponse.json({ data: UP });
      }),
    );
    renderSettings(<HealthPanel />, { role: "SYSTEM_ADMIN" });
    await screen.findByText("Everything is working");
    await userEvent.click(screen.getByRole("button", { name: "Check again" }));
    await screen.findByText("Everything is working");
    expect(calls).toBe(2);
  });

  it("shows the shape of the answer while the checks run", async () => {
    server.use(
      http.get(STATUS, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json({ data: UP });
      }),
    );
    renderSettings(<HealthPanel />, { role: "SYSTEM_ADMIN" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking the services",
    );
    expect(await screen.findByText("Everything is working")).toBeVisible();
  });

  it("shows the trace id of a failed check, and asks again on Try again", async () => {
    let calls = 0;
    server.use(
      http.get(STATUS, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-health-1"), {
              status: 500,
            })
          : HttpResponse.json({ data: UP });
      }),
    );
    renderSettings(<HealthPanel />, { role: "SYSTEM_ADMIN" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "trace-health-1",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Everything is working")).toBeVisible();
    expect(calls).toBe(2);
  });
});

describe("the service details", () => {
  it("is a list with one row for each service: its name, then its state", async () => {
    server.use(
      http.get(STATUS, () =>
        HttpResponse.json({
          data: [
            UP[0],
            { name: "redis", status: "down", durationMs: 0 },
            UP[2],
          ],
        }),
      ),
    );
    renderSettings(<HealthPanel />, { role: "SYSTEM_ADMIN" });
    await screen.findByText("1 service is not answering");
    const list = details()?.querySelector("ul");
    expect(list).not.toBeNull();
    if (!list) return;
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "DatabaseUp, 3 ms",
      "Cache and job queueDown",
      "Document storageUp, 9 ms",
    ]);
    for (const row of rows) {
      // A SettingRow: the name is its first line, in the row's grid.
      expect(row).toHaveClass("grid", "sm:grid-cols-[minmax(0,1fr)_auto]");
      expect(row.querySelector("p")).toHaveClass("font-medium");
    }
  });
});
