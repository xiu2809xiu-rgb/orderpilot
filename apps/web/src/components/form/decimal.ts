// Commas count only as grouping: 1,200 or 1,20,000 (Indian), with 3 digits last.
// A comma anywhere else may be a decimal comma, which is not read as grouping.
const WESTERN_GROUPS = /^-?\d{1,3}(,\d{3})+(\.\d*)?$/;
const INDIAN_GROUPS = /^-?\d{1,2}(,\d{2})*,\d{3}(\.\d*)?$/;
const PLAIN_DECIMAL = /^(-?)(\d*)(?:\.(\d*))?$/;

/**
 * Tidies a typed amount without ever turning it into a float: "1,200.5" with a
 * scale of 2 becomes "1200.50". What is not a number, has more decimals than
 * the scale allows, or has a comma that is not grouping, comes back as typed
 * (trimmed), so the schema can say what is wrong with it instead of the field
 * quietly changing it.
 */
export function normaliseDecimal(raw: string, scale: number): string {
  const spaced = raw.trim().replace(/\s/g, "");
  if (spaced.includes(",")) {
    // "12,50" is 12.50 to some people. Read as 1250 it would be a hundred
    // times too large with no error, so it is left for the schema to refuse.
    if (!WESTERN_GROUPS.test(spaced) && !INDIAN_GROUPS.test(spaced)) {
      return raw.trim();
    }
  }
  const text = spaced.replace(/,/g, "");
  const match = PLAIN_DECIMAL.exec(text);
  if (!match) return raw.trim();
  const [, sign = "", whole = "", fraction] = match;
  if (whole === "" && (fraction === undefined || fraction === "")) {
    return raw.trim();
  }
  if (fraction !== undefined && fraction.length > scale) return text;
  const digits = whole.replace(/^0+(?=\d)/, "") || "0";
  if (scale === 0) return `${sign}${digits}`;
  return `${sign}${digits}.${(fraction ?? "").padEnd(scale, "0")}`;
}
