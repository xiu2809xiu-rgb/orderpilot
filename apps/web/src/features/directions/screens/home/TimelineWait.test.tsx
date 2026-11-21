import type { WorkflowTask } from "@orderpilot/shared";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import { todayInSingapore } from "@/lib/format";
import { STEP_TIMES } from "../../data/index";
import { buildJourney } from "../order/journeyModel";
import { loadHomeNamespaces } from "./homeTestKit";
import { NowGroup } from "./TimelineBody";
import { buildTimeline } from "./timelineModel";

// Home's timeline and the order's page count a wait the same way: in
// Singapore's calendar days. Every moment here is passed in.

beforeAll(async () => {
  await loadHomeNamespaces();
});

const task = (createdAt: string): WorkflowTask => ({
  id: "00000000-0000-4000-8000-0000000000f1",
  kind: "SEND_PI",
  title: "Send the PI",
  assigneeRole: "SUPPORT",
  orderNo: "SO-0900",
  ref: null,
  status: "OPEN",
  createdAt,
  dueAt: "2026-11-30T09:00:00.000Z",
  overdue: false,
});

function waitingAt(createdAt: string, at: string) {
  const now = new Date(at);
  const model = buildTimeline([task(createdAt)], STEP_TIMES.sales, now, 1);
  render(
    <MemoryRouter>
      <NowGroup entry={model.now} at={now} />
    </MemoryRouter>,
  );
}

describe("the wait on Home's timeline", () => {
  it("says five days for a task made on 16 Nov at 16:00 when it is 21 Nov at 14:34, as the order's page does", () => {
    const since = "2026-11-16T08:00:00.000Z";
    const at = "2026-11-21T06:34:00.000Z";
    waitingAt(since, at);
    expect(screen.getByText("Waiting 5 days")).toBeVisible();
    // The order's page, for the same start day, says the same number.
    const journey = buildJourney({
      current: 3,
      events: [],
      stepTimes: STEP_TIMES.sales,
      today: todayInSingapore(new Date(at)),
      since: new Date(since),
    });
    expect(journey?.steps[2]?.waitedDays).toBe(5);
  });

  it("changes from minutes to one day at Singapore's midnight", () => {
    waitingAt("2026-11-20T15:30:00.000Z", "2026-11-20T15:59:00.000Z");
    expect(screen.getByText("Waiting 29 min")).toBeVisible();
  });

  it("says one day two minutes later, across the midnight", () => {
    waitingAt("2026-11-20T15:30:00.000Z", "2026-11-20T16:01:00.000Z");
    expect(screen.getByText("Waiting 1 day")).toBeVisible();
  });
});
