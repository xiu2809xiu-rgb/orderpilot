import { describe, expect, it } from "vitest";
import {
  CLICKSTREAM_MAX_BATCH,
  clickstreamBatchSchema,
  routePatternSchema,
} from "./index.js";

const at = "2026-11-01T08:00:00.000Z";

describe("route patterns", () => {
  it.each(["/", "/orders", "/orders/:id", "/master-data/vendors/:vendorId"])(
    "accepts %s",
    (route) => {
      expect(routePatternSchema.safeParse(route).success).toBe(true);
    },
  );

  it.each([
    "orders",
    "/orders/0190a1b2-0000-7000-8000-000000000001",
    "/orders/12345",
    "/orders?status=open",
    "/orders#top",
    "https://example.test/orders",
    "/orders//items",
    `/${"a".repeat(130)}`,
  ])("refuses %s", (route) => {
    expect(routePatternSchema.safeParse(route).success).toBe(false);
  });
});

describe("clickstream batches", () => {
  const event = { name: "page_view", route: "/orders/:id", at };

  it("accepts a batch of events", () => {
    expect(clickstreamBatchSchema.safeParse({ events: [event] }).success).toBe(
      true,
    );
  });

  it("refuses a field nobody planned, such as a user id", () => {
    const result = clickstreamBatchSchema.safeParse({
      events: [{ ...event, userId: "0190a1b2-0000-7000-8000-000000000001" }],
    });
    expect(result.success).toBe(false);
  });

  it("refuses an empty batch and one that is too big", () => {
    expect(clickstreamBatchSchema.safeParse({ events: [] }).success).toBe(
      false,
    );
    const tooMany = Array.from(
      { length: CLICKSTREAM_MAX_BATCH + 1 },
      () => event,
    );
    expect(clickstreamBatchSchema.safeParse({ events: tooMany }).success).toBe(
      false,
    );
  });
});
