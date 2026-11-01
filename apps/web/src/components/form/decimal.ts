const PLAIN_DECIMAL = /^(-?)(\d*)(?:\.(\d*))?$/;

/**
 * Tidies a typed amount without ever turning it into a float: "1,200.5" with a
 * scale of 2 becomes "1200.50". What is not a number, or has more decimals than
 * the scale allows, comes back trimmed but otherwise as typed, so the schema can
 * say what is wrong with it instead of the field quietly rounding it.
 */
export function normaliseDecimal(raw: string, scale: number): string {
  const text = raw.trim().replace(/[\s,]/g, "");
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
