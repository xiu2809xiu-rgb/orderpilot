import type { OrderCaptureState } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { DomainError, NotFoundError } from "../../common/domain-error.js";
import type { UserRepository } from "../../users/user.repository.js";
import { OrderMasking } from "./domain/order-masking.js";
import { PoVersionsService } from "./po-versions.service.js";
import type {
  PoVersionHistory,
  PoVersionRepository,
  StoredPoVersion,
} from "./po-version.repository.js";

const MAKER = "00000000-0000-4000-8000-000000000001";
const REVISER = "00000000-0000-4000-8000-000000000002";
const STRANGER = "00000000-0000-4000-8000-000000000003";

const line = (quantity: string, unitPrice: string) => ({
  lineNo: 1,
  itemNo: "I-0001",
  description: "Synthetic demo item",
  quantity,
  unitPrice,
  qtyToShip: quantity,
});
const version = (
  poVersionNo: number,
  current: boolean,
  quantity: string,
  unitPrice: string,
  over: Partial<StoredPoVersion> = {},
): StoredPoVersion => ({
  poVersionNo,
  current,
  content: {
    orderDate: "2026-11-08",
    shipmentDate: null,
    currencyCode: "USD",
    prepaymentPercent: "30.00",
    lines: [line(quantity, unitPrice)],
  },
  arrivedAt: new Date("2026-11-08T03:00:00.000Z"),
  arrivedBy: MAKER,
  supersededAt: current ? null : new Date("2026-11-20T03:00:00.000Z"),
  supersededBy: current ? null : REVISER,
  ...over,
});

const history = (
  captureState: OrderCaptureState = "submitted",
): PoVersionHistory => ({
  orderNo: "SO-20261108-0001",
  captureState,
  versions: [
    version(1, false, "229.000", "31.97"),
    version(
      2,
      false,
      "230.000",
      "31.97",
      // Superseded by someone whose account is gone.
      { arrivedBy: REVISER, supersededBy: STRANGER },
    ),
    version(3, true, "230.000", "33.41", {
      arrivedBy: STRANGER,
      arrivedAt: new Date("2026-11-22T03:00:00.000Z"),
    }),
  ],
});

function build(found: PoVersionHistory | null) {
  const service = new PoVersionsService(
    {
      historyOf: () => Promise.resolve(found),
    } as unknown as PoVersionRepository,
    new OrderMasking(),
    {
      namesByIds: () =>
        Promise.resolve(
          new Map([
            [MAKER, "Synthetic Maker"],
            [REVISER, "Synthetic Reviser"],
          ]),
        ),
    } as unknown as UserRepository,
  );
  return service;
}

const refusal = async (call: Promise<unknown>): Promise<DomainError> => {
  const error: unknown = await call.catch((e: unknown) => e);
  if (error instanceof DomainError) return error;
  throw new Error("did not throw a DomainError");
};

describe("PoVersionsService", () => {
  it("lists the current version and the superseded ones, newest first, with the person's name and null for an unknown id", async () => {
    const list = await build(history()).list("SO-20261108-0001", "SUPPORT");
    expect(list.currentPoVersionNo).toBe(3);
    expect(list.versions.map((v) => [v.poVersionNo, v.current])).toEqual([
      [3, true],
      [2, false],
      [1, false],
    ]);
    const [three, two, one] = list.versions;
    expect(one).toMatchObject({
      arrivedBy: "Synthetic Maker",
      supersededBy: "Synthetic Reviser",
      supersededAt: "2026-11-20T03:00:00.000Z",
      lineCount: 1,
    });
    expect(two).toMatchObject({
      arrivedBy: "Synthetic Reviser",
      supersededBy: null,
    });
    expect(three).toMatchObject({
      arrivedBy: null,
      supersededAt: null,
      supersededBy: null,
    });
    expect(one?.total).toMatchObject({ masked: false, value: "7321.13" });
  });

  it("masks the total, every unit price and every line amount for a role that cannot see prices", async () => {
    const service = build(history());
    const list = await service.list("SO-20261108-0001", "WAREHOUSE");
    const detail = await service.one("SO-20261108-0001", 1, "LOGISTICS");
    const text = JSON.stringify([list, detail]);
    for (const price of ["31.97", "33.41", "7321.13", "7684.30"])
      expect(text).not.toContain(price);
    for (const v of list.versions)
      expect(v.total).toMatchObject({ masked: true, value: null });
    expect(detail.lines[0]?.unitPrice).toMatchObject({
      masked: true,
      value: null,
    });
    expect(detail.lines[0]?.lineAmount).toMatchObject({
      masked: true,
      value: null,
    });
    // Quantities are not prices.
    expect(detail.lines[0]?.quantity).toBe("229.000");
  });

  it("answers 404 for an unknown order and for an unknown PO version", async () => {
    await expect(
      build(null).list("SO-20261108-0001", "SUPPORT"),
    ).rejects.toBeInstanceOf(NotFoundError);
    const service = build(history());
    const missing = await refusal(
      service.one("SO-20261108-0001", 4, "SUPPORT"),
    );
    expect(missing.code).toBe("NOT_FOUND");
    expect(missing.message).toBe("PO version was not found.");
    const beyond = await refusal(
      service.diff("SO-20261108-0001", 1, 4, "SUPPORT"),
    );
    expect(beyond.message).toBe("PO version was not found.");
    const unknown = await refusal(build(null).one("SO-1", 1, "SUPPORT"));
    expect(unknown.message).toBe("Order was not found.");
  });

  it("answers 409 for a draft and a void order on all three reads", async () => {
    for (const state of ["draft", "void"] as const) {
      const service = build(history(state));
      for (const call of [
        service.list("SO-20261108-0001", "SUPPORT"),
        service.one("SO-20261108-0001", 1, "SUPPORT"),
        service.diff("SO-20261108-0001", 1, 2, "SUPPORT"),
      ]) {
        const error = await refusal(call);
        expect(error.code).toBe("CONFLICT");
        expect(error.details).toEqual([
          { path: "captureState", message: state },
        ]);
      }
    }
    const draft = await refusal(
      build(history("draft")).list("SO-20261108-0001", "SUPPORT"),
    );
    expect(draft.message).toBe(
      "Order SO-20261108-0001 is a draft, so it has no PO versions yet. It becomes PO version 1 when it is submitted.",
    );
  });

  it("refuses a diff whose from is not below to, on to", async () => {
    const service = build(history());
    for (const [from, to] of [
      [2, 2],
      [3, 1],
    ] as const) {
      const error = await refusal(
        service.diff("SO-20261108-0001", from, to, "SUPPORT"),
      );
      expect(error.code).toBe("VALIDATION_FAILED");
      expect(error.details).toEqual([
        {
          path: "to",
          message: "Compare an earlier PO version with a later one.",
        },
      ]);
    }
  });

  it("compares prices only for a role that sees them", async () => {
    const service = build(history());
    const sees = await service.diff("SO-20261108-0001", 2, 3, "SUPPORT");
    expect(sees.pricesCompared).toBe(true);
    expect(sees.lines[0]?.status).toBe("changed");
    const hidden = await service.diff("SO-20261108-0001", 2, 3, "WAREHOUSE");
    expect(hidden.pricesCompared).toBe(false);
    expect(hidden.lines[0]?.status).toBe("unchanged");
    expect(hidden.identical).toBe(true);
    const text = JSON.stringify(hidden);
    expect(text).not.toContain("33.41");
    expect(text).not.toContain("31.97");
  });
});
