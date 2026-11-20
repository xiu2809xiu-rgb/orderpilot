/**
 * The words of the glossary in `components.json` (`glossary.<key>`), in the
 * order Help lists them. Help and every page read the same lines. This file
 * holds only the list: it is imported by the shell's first load, so it must
 * never pull in the tooltip.
 */
export const GLOSSARY_KEYS = [
  "spr",
  "po",
  "pi",
  "packingList",
  "awb",
  "bl",
  "heldAt",
  "shortOnStock",
  "businessCentral",
] as const;

export type GlossaryKey = (typeof GLOSSARY_KEYS)[number];
