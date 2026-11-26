import { describe, expect, it } from "vitest";
import {
  PERSON_AVAILABILITIES,
  PERSON_AVAILABILITY_HOLD_HOURS,
  PERSON_AVAILABILITY_LOOKUP_MAX_IDS,
  authOptionsSchema,
  availabilityEntrySchema,
  availabilityLookupQuerySchema,
  lookupIdsOf,
  myAvailabilitySchema,
  personAvailabilityRoutes,
  setAvailabilityRequestSchema,
} from "./index.js";

/** Synthetic, valid version 7 ids; the last group counts up so each is distinct. */
function idNumber(n: number): string {
  return `0192a000-0000-7000-8000-${String(n).padStart(12, "0")}`;
}
const ONE = idNumber(1);

function lookup(ids: string) {
  return availabilityLookupQuerySchema.safeParse({ ids });
}

describe("person availability contract", () => {
  it("keeps the three values in order, the hold at 12 hours and the maximum at 100", () => {
    expect(PERSON_AVAILABILITIES).toEqual([
      "AVAILABLE",
      "FOCUSING",
      "DO_NOT_DISTURB",
    ]);
    expect(PERSON_AVAILABILITY_HOLD_HOURS).toBe(12);
    expect(PERSON_AVAILABILITY_LOOKUP_MAX_IDS).toBe(100);
  });

  describe("the lookup query", () => {
    it("accepts one uuid and 100, and refuses 101", () => {
      const hundred = Array.from({ length: 100 }, (_, n) => idNumber(n + 1));
      expect(lookup(ONE).success).toBe(true);
      expect(lookup(hundred.join(",")).success).toBe(true);
      expect(lookup([...hundred, idNumber(101)].join(",")).success).toBe(false);
    });

    it("refuses none, an empty value, a space after a comma and a trailing comma", () => {
      expect(availabilityLookupQuerySchema.safeParse({}).success).toBe(false);
      expect(lookup("").success).toBe(false);
      expect(lookup(`${ONE}, ${idNumber(2)}`).success).toBe(false);
      expect(lookup(`${ONE},`).success).toBe(false);
      expect(lookup(`,${ONE}`).success).toBe(false);
      expect(lookup(`${ONE},,${idNumber(2)}`).success).toBe(false);
    });

    it("refuses a value that is not a uuid, and an array", () => {
      expect(lookup("not-an-id").success).toBe(false);
      expect(lookup(`${ONE},nope`).success).toBe(false);
      expect(
        availabilityLookupQuerySchema.safeParse({ ids: [ONE, idNumber(2)] })
          .success,
      ).toBe(false);
    });

    it("accepts the nil id and an upper-case id", () => {
      expect(lookup("00000000-0000-0000-0000-000000000000").success).toBe(true);
      expect(lookup(ONE.toUpperCase()).success).toBe(true);
    });
  });

  describe("lookupIdsOf", () => {
    it("lower-cases, makes distinct and keeps the order first asked", () => {
      const query = availabilityLookupQuerySchema.parse({
        ids: [
          idNumber(3),
          ONE.toUpperCase(),
          idNumber(2),
          ONE,
          idNumber(3).toUpperCase(),
        ].join(","),
      });
      expect(lookupIdsOf(query)).toEqual([idNumber(3), ONE, idNumber(2)]);
    });

    it("keeps the nil id as an id", () => {
      const nil = "00000000-0000-0000-0000-000000000000";
      const query = availabilityLookupQuerySchema.parse({ ids: nil });
      expect(lookupIdsOf(query)).toEqual([nil]);
    });
  });

  describe("the set body", () => {
    it("accepts each of the three values", () => {
      for (const value of PERSON_AVAILABILITIES) {
        expect(setAvailabilityRequestSchema.safeParse({ value }).success).toBe(
          true,
        );
      }
    });

    it("refuses an unknown value, no value and an extra key", () => {
      expect(
        setAvailabilityRequestSchema.safeParse({ value: "AWAY" }).success,
      ).toBe(false);
      expect(setAvailabilityRequestSchema.safeParse({}).success).toBe(false);
      expect(
        setAvailabilityRequestSchema.safeParse({
          value: "FOCUSING",
          userId: ONE,
        }).success,
      ).toBe(false);
      expect(
        setAvailabilityRequestSchema.safeParse({
          value: "FOCUSING",
          setAt: "2031-03-01T09:00:00.000Z",
        }).success,
      ).toBe(false);
    });
  });

  it("accepts null times in an own answer and in an entry", () => {
    expect(
      myAvailabilitySchema.safeParse({
        value: "AVAILABLE",
        setAt: null,
        expiresAt: null,
      }).success,
    ).toBe(true);
    expect(
      availabilityEntrySchema.safeParse({
        userId: ONE,
        value: "AVAILABLE",
        setAt: null,
      }).success,
    ).toBe(true);
  });

  it("describes the three routes", () => {
    const { mine, set, lookup: lookupRoute } = personAvailabilityRoutes;
    expect([mine.method, mine.path, mine.csrf]).toEqual([
      "GET",
      "/availability/mine",
      false,
    ]);
    expect([set.method, set.path, set.csrf]).toEqual([
      "PUT",
      "/availability/mine",
      true,
    ]);
    expect([lookupRoute.method, lookupRoute.path, lookupRoute.csrf]).toEqual([
      "GET",
      "/availability",
      false,
    ]);
  });

  describe("the sign-in options", () => {
    const base = { role: "SUPPORT", displayName: "Mei Tan" };
    const parse = (entry: object) =>
      authOptionsSchema.safeParse({ demoMode: true, demoRoles: [entry] });

    it("accepts an entry with and without a userId", () => {
      expect(parse(base).success).toBe(true);
      expect(parse({ ...base, userId: ONE }).success).toBe(true);
    });

    it("refuses a userId that is not a uuid", () => {
      expect(parse({ ...base, userId: "support" }).success).toBe(false);
    });
  });
});
