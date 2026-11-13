import type { Vendor } from "./ItemCard";

/**
 * Every item in kit/, by the key of its name in the locale file and its
 * vendor. The kit sheet's summary counts from this list, and a test checks
 * that the sections show exactly these and no others.
 */
export const KIT_ITEMS: readonly {
  key: string;
  vendor: Vendor;
  /** The item's code is not a file of kit/ (the WebGPU orb lives with Spark). */
  outside?: true;
}[] = [
  { key: "numberTicker", vendor: "magic" },
  { key: "blurFade", vendor: "magic" },
  { key: "borderBeam", vendor: "magic" },
  { key: "shineBorder", vendor: "magic" },
  { key: "animatedList", vendor: "magic" },
  { key: "shinyText", vendor: "magic" },
  { key: "circularProgress", vendor: "magic" },
  { key: "dotPattern", vendor: "magic" },
  { key: "gradientText", vendor: "bits" },
  { key: "blurText", vendor: "bits" },
  { key: "spotlightCard", vendor: "bits" },
  { key: "glassSurface", vendor: "bits" },
  { key: "statusMark", vendor: "bits" },
  { key: "latticeLoader", vendor: "bits" },
  { key: "thoughtLine", vendor: "bits" },
  { key: "holdButton", vendor: "bits" },
  { key: "aurora", vendor: "bits" },
  { key: "stepper", vendor: "reui" },
  { key: "timeline", vendor: "reui" },
  { key: "badge", vendor: "reui" },
  { key: "frame", vendor: "reui" },
  { key: "alert", vendor: "reui" },
  { key: "fileType", vendor: "reui" },
  { key: "fileDropzone", vendor: "reui" },
  { key: "promptBar", vendor: "bits" },
  { key: "orb", vendor: "bits" },
  { key: "liquidOrb", vendor: "orb", outside: true },
];

export const itemsOf = (vendor: Vendor): number =>
  KIT_ITEMS.filter((item) => item.vendor === vendor).length;
