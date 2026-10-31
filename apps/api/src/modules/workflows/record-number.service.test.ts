import { recordNumberSchema, type RecordType } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import type { RecordNumberRepository } from "./record-number.repository.js";
import { RecordNumberService } from "./record-number.service.js";

/** A counter in memory, with the same take-the-next contract as the table. */
class MemoryCounters {
  readonly rows = new Map<string, number>();
  take(type: RecordType, day: string): Promise<number> {
    const key = `${type}-${day}`;
    const next = (this.rows.get(key) ?? 0) + 1;
    this.rows.set(key, next);
    return Promise.resolve(next);
  }
}

function serviceOver(counters: MemoryCounters): RecordNumberService {
  return new RecordNumberService(counters as unknown as RecordNumberRepository);
}

describe("RecordNumberService", () => {
  it("writes the type, the Singapore day and a four-digit running number", async () => {
    const service = serviceOver(new MemoryCounters());
    const at = new Date("2026-11-02T02:00:00Z");
    expect(await service.next("SPR", at)).toBe("SPR-20261102-0001");
    expect(await service.next("SPR", at)).toBe("SPR-20261102-0002");
  });

  it("counts each type and each day on its own", async () => {
    const service = serviceOver(new MemoryCounters());
    expect(await service.next("SPR", new Date("2026-11-02T02:00:00Z"))).toBe(
      "SPR-20261102-0001",
    );
    expect(await service.next("PI", new Date("2026-11-02T02:00:00Z"))).toBe(
      "PI-20261102-0001",
    );
    expect(await service.next("SPR", new Date("2026-11-03T02:00:00Z"))).toBe(
      "SPR-20261103-0001",
    );
  });

  it("uses Singapore time: 17:00 UTC is already tomorrow there", async () => {
    const service = serviceOver(new MemoryCounters());
    const number = await service.next("EXC", new Date("2026-11-02T17:00:00Z"));
    expect(number).toBe("EXC-20261103-0001");
    expect(recordNumberSchema.safeParse(number).success).toBe(true);
  });
});
