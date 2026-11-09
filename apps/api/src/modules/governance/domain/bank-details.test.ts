import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import {
  BankDetails,
  BankFingerprinter,
  containsAccountNumber,
  type BankField,
  type RawBankDetails,
} from "./bank-details.js";

const KEY = "test-only-bank-fingerprint-key-0000000000000000";
const fingerprinter = new BankFingerprinter(KEY);

// Obviously fake: ZZ is not a country, and the bank names itself a demo.
const ACCOUNT = "000000009901";
const SWIFT = "DEMOZZ00";
const IBAN = "ZZ00DEMO0000000009901";

const seal = (raw: RawBankDetails) => BankDetails.from(raw).seal(fingerprinter);
const fingerprintOf = (field: BankField, value: string) =>
  seal({ [field]: value })[field]?.fingerprint;

describe("comparing bank details whatever their format", () => {
  it("ignores spaces, hyphens, dots and case in an account number", () => {
    const stored = fingerprintOf("bankAccountNo", "12345ABC678");
    for (const written of ["12345 abc 678", "12345-ABC-678", "12345.ABC.678"]) {
      expect(fingerprintOf("bankAccountNo", written), written).toBe(stored);
    }
  });

  it("ignores spaces, hyphens and case in an IBAN", () => {
    const stored = fingerprintOf("iban", IBAN);
    expect(fingerprintOf("iban", "zz00 demo 0000 0000 0990 1")).toBe(stored);
    expect(fingerprintOf("iban", "ZZ00-DEMO-0000-0000-0990-1")).toBe(stored);
  });

  it("treats an eight-character SWIFT code and its XXX form as the same", () => {
    expect(fingerprintOf("swiftCode", "demozz00")).toBe(
      fingerprintOf("swiftCode", "DEMOZZ00XXX"),
    );
    expect(fingerprintOf("swiftCode", "DEMOZZ00ABC")).not.toBe(
      fingerprintOf("swiftCode", "DEMOZZ00XXX"),
    );
  });

  it("keeps leading zeros significant", () => {
    expect(fingerprintOf("bankAccountNo", "0012345678")).not.toBe(
      fingerprintOf("bankAccountNo", "12345678"),
    );
  });

  it("treats a blank or missing field as absent", () => {
    for (const value of [null, undefined, "", "   ", " - "]) {
      expect(seal({ bankAccountNo: value }).bankAccountNo).toBeNull();
    }
  });
});

describe("masking to the last four", () => {
  it("shows only the last four characters of the normalised value", () => {
    expect(
      seal({ bankAccountNo: "0000 0000 9901" }).bankAccountNo?.masked,
    ).toBe("****9901");
    expect(seal({ iban: IBAN }).iban?.masked).toBe("****9901");
  });

  it("does not show the padding of a SWIFT code as its last four", () => {
    expect(seal({ swiftCode: SWIFT }).swiftCode?.masked).toBe("****ZZ00");
    expect(seal({ swiftCode: `${SWIFT}XXX` }).swiftCode?.masked).toBe(
      "****ZZ00",
    );
    expect(seal({ swiftCode: "DEMOZZ00ABC" }).swiftCode?.masked).toBe(
      "****0ABC",
    );
  });

  it("shows nothing of a value too short for four characters to be safe", () => {
    expect(seal({ bankAccountNo: "1234567" }).bankAccountNo?.masked).toBe(
      "****",
    );
    expect(seal({ bankAccountNo: "12345678" }).bankAccountNo?.masked).toBe(
      "****5678",
    );
  });
});

describe("the fingerprint", () => {
  it("is the same for the same value, and hides it", () => {
    const first = fingerprintOf("bankAccountNo", ACCOUNT);
    expect(first).toBe(fingerprintOf("bankAccountNo", ACCOUNT));
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain(ACCOUNT);
  });

  it("differs from field to field, so one value in two fields does not match", () => {
    const same = "ZZ00DEMO12345678";
    expect(fingerprintOf("bankAccountNo", same)).not.toBe(
      fingerprintOf("iban", same),
    );
  });

  it("depends on the key, so a stolen table cannot be guessed offline", () => {
    const other = new BankFingerprinter(`${KEY}-other`);
    expect(
      BankDetails.from({ bankAccountNo: ACCOUNT }).seal(other).bankAccountNo
        ?.fingerprint,
    ).not.toBe(fingerprintOf("bankAccountNo", ACCOUNT));
  });

  it("fails closed without a key, naming the setting and no number", () => {
    const keyless = new BankFingerprinter(null);
    expect(keyless.configured).toBe(false);
    expect(fingerprinter.configured).toBe(true);
    const details = BankDetails.from({ bankAccountNo: ACCOUNT });
    expect(() => details.seal(keyless)).toThrow(/BANK_FINGERPRINT_KEY/);
    try {
      details.seal(keyless);
    } catch (error) {
      expect(String(error)).not.toContain(ACCOUNT);
    }
  });
});

describe("what can never be printed", () => {
  const details = BankDetails.from({
    bankAccountNo: ACCOUNT,
    swiftCode: SWIFT,
    iban: IBAN,
  });

  it("keeps the numbers out of JSON, strings and inspection", () => {
    for (const printed of [
      JSON.stringify(details),
      JSON.stringify({ nested: { details } }),
      String(details),
      inspect(details),
      inspect({ details }, { depth: 5, showHidden: true }),
    ]) {
      for (const secret of [ACCOUNT, IBAN, SWIFT]) {
        expect(printed, printed).not.toContain(secret);
      }
    }
  });

  it("keeps the key out of JSON and inspection", () => {
    for (const printed of [
      JSON.stringify(fingerprinter),
      inspect(fingerprinter, { depth: 5, showHidden: true }),
    ]) {
      expect(printed).not.toContain(KEY);
    }
  });
});

describe("spotting an account number in free text", () => {
  it("finds long numbers, however they are written", () => {
    for (const text of [
      `Vendor gave ${ACCOUNT} on the call`,
      "Account 0000 0000 9901 confirmed",
      "Account 0000-0000-9901 confirmed",
      `New IBAN is ${IBAN}`,
      `new iban ${IBAN.toLowerCase()}`,
      "IBAN ZZ00 DEMO 0000 0000 0099 01",
    ]) {
      expect(containsAccountNumber(text), text).toBe(true);
    }
  });

  it("leaves dates, times, short references and masked values alone", () => {
    for (const text of [
      "Called on 2026-11-10 at 14:30",
      "Called on 10/11/2026",
      "See PO 1234 and PI 88",
      "PO12 was sent to accounts today",
      "Spoke to accounts about ****9901",
      "The contact came from the stored vendor record",
    ]) {
      expect(containsAccountNumber(text), text).toBe(false);
    }
  });
});
