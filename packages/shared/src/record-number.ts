import { z } from "zod";

/** OrderPilot's own record types and their number prefixes. */
export const RECORD_TYPES = ["SPR", "PI", "EXC"] as const;
export const recordTypeSchema = z.enum(RECORD_TYPES);
export type RecordType = z.infer<typeof recordTypeSchema>;

/** `SPR-20261102-0001`: type prefix, date (Singapore), running number for that day and type. */
export const recordNumberSchema = z
  .string()
  .regex(/^(SPR|PI|EXC)-\d{8}-\d{4,}$/, "Use a number like SPR-20261102-0001");
export type RecordNumber = z.infer<typeof recordNumberSchema>;

const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;

/** `YYYYMMDD` in Singapore time: the day a running number belongs to. */
export function recordDay(date: Date): string {
  const sg = new Date(date.getTime() + SINGAPORE_OFFSET_MS);
  const y = sg.getUTCFullYear().toString().padStart(4, "0");
  const m = (sg.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = sg.getUTCDate().toString().padStart(2, "0");
  return `${y}${m}${d}`;
}

/** The running number restarts at 1 each day for each type. Four digits at least. */
export function formatRecordNumber(
  type: RecordType,
  date: Date,
  sequence: number,
): RecordNumber {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError("The running number starts at 1");
  }
  return `${type}-${recordDay(date)}-${sequence.toString().padStart(4, "0")}`;
}

export interface ParsedRecordNumber {
  type: RecordType;
  /** YYYYMMDD, as written. */
  date: string;
  sequence: number;
}

export function parseRecordNumber(value: string): ParsedRecordNumber | null {
  const match = /^(SPR|PI|EXC)-(\d{8})-(\d{4,})$/.exec(value);
  if (!match) return null;
  return {
    type: match[1] as RecordType,
    date: match[2] ?? "",
    sequence: Number(match[3]),
  };
}

/**
 * OrderPilot's number shown beside Navision's, which stays the official one.
 * `navisionNo` is null until the record exists in Navision.
 */
export const recordRefSchema = z.object({
  recordNo: recordNumberSchema,
  navisionNo: z.string().min(1).nullable(),
});
export type RecordRef = z.infer<typeof recordRefSchema>;
