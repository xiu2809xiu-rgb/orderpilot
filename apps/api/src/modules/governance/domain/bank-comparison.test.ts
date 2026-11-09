import { describe, expect, it } from "vitest";
import {
  acceptedDetails,
  compareWithBaselines,
  digestOf,
  scopeOf,
  type BaselineAccount,
} from "./bank-comparison.js";
import {
  BankDetails,
  BankFingerprinter,
  type RawBankDetails,
  type SealedBankDetails,
} from "./bank-details.js";

const fingerprinter = new BankFingerprinter(
  "test-only-bank-fingerprint-key-0000000000000000",
);
const seal = (raw: RawBankDetails): SealedBankDetails =>
  BankDetails.from(raw).seal(fingerprinter);

const RECORD = {
  bankAccountNo: "000000009901",
  swiftCode: "DEMOZZ00",
  iban: "ZZ00DEMO0000000009901",
};
const account = (
  accountCode: string,
  raw: RawBankDetails = RECORD,
): BaselineAccount => ({ accountCode, sealed: seal(raw) });
const MAIN = [account("MAIN")];

describe("which fields a source compares", () => {
  it("compares every field of a record edit, and what a document carries", () => {
    expect(scopeOf("vendor-record")).toBe("all-fields");
    expect(scopeOf("vendor-pi")).toBe("carried-fields");
    expect(scopeOf("vendor-invoice")).toBe("carried-fields");
  });
});

describe("comparing with the stored details", () => {
  it("finds no difference when every field matches", () => {
    const result = compareWithBaselines(seal(RECORD), MAIN, "carried-fields");
    expect(result.differingFields).toEqual([]);
    expect(result.accountCode).toBe("MAIN");
  });

  it("names each field that differs on its own", () => {
    for (const [field, value] of [
      ["bankAccountNo", "000000007702"],
      ["swiftCode", "DEMOZZ77"],
      ["iban", "ZZ00DEMO0000000007702"],
    ] as const) {
      const result = compareWithBaselines(
        seal({ ...RECORD, [field]: value }),
        MAIN,
        "carried-fields",
      );
      expect(result.differingFields, field).toEqual([field]);
    }
  });

  it("does not count a field a document simply does not carry", () => {
    const result = compareWithBaselines(
      seal({ bankAccountNo: RECORD.bankAccountNo }),
      MAIN,
      "carried-fields",
    );
    expect(result.differingFields).toEqual([]);
  });

  it("counts a field a record edit has removed", () => {
    const result = compareWithBaselines(
      seal({ ...RECORD, iban: null }),
      MAIN,
      "all-fields",
    );
    expect(result.differingFields).toEqual(["iban"]);
  });

  it("counts a field a document carries and the record lacks", () => {
    const result = compareWithBaselines(
      seal(RECORD),
      [account("MAIN", { ...RECORD, iban: null })],
      "carried-fields",
    );
    expect(result.differingFields).toEqual(["iban"]);
  });

  it("treats every carried field as different when nothing is stored", () => {
    const result = compareWithBaselines(
      seal({
        bankAccountNo: RECORD.bankAccountNo,
        swiftCode: RECORD.swiftCode,
      }),
      [],
      "carried-fields",
    );
    expect(result).toMatchObject({
      accountCode: null,
      differingFields: ["bankAccountNo", "swiftCode"],
      before: null,
    });
  });

  describe("with several accounts on record", () => {
    const other = { ...RECORD, bankAccountNo: "000000005503" };
    const both = [account("MAIN"), account("USD", other)];

    it("matches any of them", () => {
      expect(
        compareWithBaselines(seal(other), both, "carried-fields")
          .differingFields,
      ).toEqual([]);
    });

    it("reports against the closest one", () => {
      const result = compareWithBaselines(
        seal({ ...other, iban: "ZZ00DEMO0000000007702" }),
        both,
        "carried-fields",
      );
      expect(result.accountCode).toBe("USD");
      expect(result.differingFields).toEqual(["iban"]);
    });

    it("compares a record edit with its own account only", () => {
      const result = compareWithBaselines(
        seal(other),
        both,
        "all-fields",
        "MAIN",
      );
      expect(result.accountCode).toBe("MAIN");
      expect(result.differingFields).toEqual(["bankAccountNo"]);
    });

    it("counts a record edit on an account not yet stored as different", () => {
      const result = compareWithBaselines(
        seal(RECORD),
        both,
        "all-fields",
        "EUR",
      );
      expect(result).toMatchObject({ accountCode: "EUR", before: null });
      expect(result.differingFields).toEqual([
        "bankAccountNo",
        "swiftCode",
        "iban",
      ]);
    });
  });
});

describe("one fingerprint for one proposal", () => {
  it("is the same for the same details and differs when any field does", () => {
    expect(digestOf(seal(RECORD))).toBe(
      digestOf(seal({ ...RECORD, iban: "zz00 demo 0000 0000 0990 1" })),
    );
    expect(digestOf(seal(RECORD))).not.toBe(
      digestOf(seal({ ...RECORD, swiftCode: "DEMOZZ77" })),
    );
    expect(digestOf(seal(RECORD))).not.toBe(
      digestOf(seal({ ...RECORD, iban: null })),
    );
  });
});

describe("what a cleared hold makes the stored details", () => {
  const proposed = seal({ bankAccountNo: "000000007702" });

  it("takes only what a document carried, and keeps the rest", () => {
    const stored = seal(RECORD);
    const accepted = acceptedDetails(stored, proposed, "carried-fields");
    expect(accepted.bankAccountNo).toEqual(proposed.bankAccountNo);
    expect(accepted.swiftCode).toEqual(stored.swiftCode);
    expect(accepted.iban).toEqual(stored.iban);
  });

  it("takes a record edit whole, removed fields included", () => {
    expect(acceptedDetails(seal(RECORD), proposed, "all-fields")).toEqual(
      proposed,
    );
  });

  it("takes the proposal when nothing was stored", () => {
    expect(acceptedDetails(null, proposed, "carried-fields")).toEqual(proposed);
  });
});
