import { extensionOf } from "../../kit/FileType";

/** What the preview accepts, written on the drop zone before anyone tries. */
export const ACCEPTED_KINDS = ["pdf", "png", "jpeg", "xlsx", "csv"] as const;
export type AcceptedKind = (typeof ACCEPTED_KINDS)[number];

export const MAX_MB = 10;
export const MAX_BYTES = MAX_MB * 1024 * 1024;
export const MAX_FILES = 5;

/** The `accept` attribute of the file input: extensions and types. */
export const ACCEPT = ".pdf,.png,.jpg,.jpeg,.xlsx,.csv";

export type Refusal = "type" | "size" | "empty" | "disguised" | "tooMany";

export type Verdict =
  | { ok: true; kind: AcceptedKind }
  | { ok: false; reason: Refusal; claimed?: string };

const EXTENSION_KIND: Record<string, AcceptedKind> = {
  pdf: "pdf",
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  xlsx: "xlsx",
  csv: "csv",
};

const startsWith = (head: Uint8Array, bytes: readonly number[]) =>
  bytes.every((byte, index) => head[index] === byte);

/** What the first bytes say the file is, or null where they say nothing useful. */
export function sniff(head: Uint8Array): AcceptedKind | "text" | null {
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "jpeg";
  // A zip: an XLSX workbook is one. Other zips are caught by the extension.
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return "xlsx";
  // Text has no control bytes other than tab, line feeds and a carriage return.
  const isText = Array.from(head).every(
    (byte) => byte === 9 || byte === 10 || byte === 13 || byte >= 32,
  );
  return isText && head.length > 0 ? "text" : null;
}

/**
 * What the name and the size alone can refuse, before a byte is read: a type
 * that is not accepted, an empty file, a file over the limit.
 */
export function precheck(name: string, size: number): Refusal | null {
  if (!EXTENSION_KIND[extensionOf(name)]) return "type";
  if (size === 0) return "empty";
  if (size > MAX_BYTES) return "size";
  return null;
}

/**
 * Whether a file is accepted: its extension, its size and its first bytes must
 * all agree. A name that says PDF over content that is not a PDF is refused as
 * disguised, which is what type sniffing is for. This is the preview's own
 * check, in the browser; the real upload API checks again on the server.
 */
export function checkFile(
  name: string,
  size: number,
  head: Uint8Array,
): Verdict {
  const early = precheck(name, size);
  if (early) return { ok: false, reason: early };
  const extension = extensionOf(name);
  const kind = EXTENSION_KIND[extension];
  if (!kind) return { ok: false, reason: "type" };
  const seen = sniff(head);
  const agrees = kind === "csv" ? seen === "text" : seen === kind;
  if (!agrees) return { ok: false, reason: "disguised", claimed: extension };
  return { ok: true, kind };
}
