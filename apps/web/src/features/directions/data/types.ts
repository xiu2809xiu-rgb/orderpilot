/** The shapes of the three JSON files `pnpm` writes with directions-data.mjs. */

export type StepUnit = "days" | "hours";

export interface DataSource {
  script: string;
  dataSet: string;
  label: string;
  seed: number;
  referenceDate: string;
}

export interface StepTime {
  /** The step's key, as the tracker names it for sales. */
  id: string;
  /** Its place in the journey, 1 to 9. */
  position: number;
  measured: boolean;
  /** What the clock starts and stops on; null when the step is left out. */
  from: string | null;
  to: string | null;
  /** JSON gives a plain string; `statOf` narrows it to a StepUnit. */
  unit: string | null;
  /** Orders that went through the step. */
  n: number;
  p25: number | null;
  median: number | null;
  p75: number | null;
  /** Why a step is left out, or how its span is taken. */
  note: string;
}

export interface VendorSpan {
  vendorNo: string;
  vendorName: string;
  n: number;
  p25: number;
  median: number;
  p75: number;
}

export interface PurchaseSpan {
  id: string;
  fromStep: string;
  toStep: string;
  unit: string;
  n: number;
  p25: number;
  median: number;
  p75: number;
  note: string;
  byVendor: VendorSpan[];
}

export interface StepTimes {
  source: DataSource;
  method: string;
  /** Orders in the data set. */
  orders: number;
  sales: StepTime[];
  purchase: StepTime[];
  purchaseSpans: PurchaseSpan[];
}

export interface MonthlyLine {
  amountUsd: number[];
  units: number[];
}

export interface BrandHistory extends MonthlyLine {
  brand: string;
  category: string;
}

export interface ForecastRange {
  month: string;
  forecast: number;
  low: number;
  high: number;
}

export interface History {
  source: DataSource;
  /** The 24 months before the reference month, oldest first. */
  months: string[];
  total: MonthlyLine;
  brands: BrandHistory[];
  forecast: {
    /** One line a person can read on screen next to the chart. */
    method: string;
    name: string;
    season: number;
    rangeMultiplier: number;
    errorMonths: number;
    /** The method's own error on the history, in USD a month. */
    errorUsd: number;
    amountUsd: ForecastRange[];
  };
}

export interface StockItem {
  itemNo: string;
  description: string;
  partNumber: string;
  vendorNo: string;
  onHand: number;
  onSalesOrders: number;
  onPurchaseOrders: number;
  available: number;
}

export interface StockAnswer {
  source: DataSource;
  question: string;
  brand: string;
  note: string;
  items: StockItem[];
  totals: {
    onHand: number;
    onSalesOrders: number;
    onPurchaseOrders: number;
    available: number;
  };
  /** Other brands with monitors in the catalogue, for a follow-up. */
  otherBrands: { brand: string; items: number; available: number }[];
}

/** The measured figures of one step: what the estimates are built from. */
export interface StepStat {
  unit: StepUnit;
  n: number;
  p25: number;
  median: number;
  p75: number;
}
