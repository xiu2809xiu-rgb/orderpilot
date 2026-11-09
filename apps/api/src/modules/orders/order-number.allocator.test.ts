import { recordNumberSchema, type RecordType } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import type { RecordNumberService } from "../workflows/record-number.service.js";
import { OrderNumberAllocator } from "./order-number.allocator.js";

class FakeNumbers {
  readonly asked: { type: RecordType; at: Date }[] = [];
  next(type: RecordType, at: Date): Promise<string> {
    this.asked.push({ type, at });
    return Promise.resolve(`${type}-20261108-000${String(this.asked.length)}`);
  }
}

describe("OrderNumberAllocator", () => {
  it("asks for the SO type and passes the moment on", async () => {
    const numbers = new FakeNumbers();
    const allocator = new OrderNumberAllocator(
      numbers as unknown as RecordNumberService,
    );
    const at = new Date("2026-11-08T02:00:00Z");
    const first = await allocator.next(at);
    expect(first).toBe("SO-20261108-0001");
    expect(recordNumberSchema.safeParse(first).success).toBe(true);
    expect(numbers.asked).toEqual([{ type: "SO", at }]);
  });
});
