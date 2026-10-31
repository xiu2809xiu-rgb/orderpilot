import {
  makeBrands,
  makeCustomers,
  makeItems,
  makePeople,
  makeVendorBankAccounts,
  makeVendors,
  openingBalances,
} from "./catalogue.js";
import { todayInSingapore } from "./dates.js";
import { documentFactory } from "./documents.js";
import { makeExceptions } from "./exceptions.js";
import { planJourneys } from "./journey.js";
import { makeKpis } from "./kpis.js";
import { makeOrders } from "./orders.js";
import { makePayments } from "./payments.js";
import { SeededRandom } from "./random.js";
import { RecordNumberer } from "./records.js";
import { makeSprs } from "./sprs.js";
import { SYNTHETIC_LABEL, type SyntheticDataset } from "./types.js";
import { makeReminders, makeTasks } from "./work.js";

export const DEFAULT_SEED = 20261102;

/** The reference date tests and fixtures use, so "overdue" and "age" never drift under them. */
export const AS_OF = "2026-11-02";

export interface DatasetOptions {
  /** Same seed and reference date, byte-identical data. */
  seed?: number;
  /** "Today" for every date in the data, as `YYYY-MM-DD`. Defaults to the fixed test date. */
  referenceDate?: string;
}

/**
 * Builds the synthetic dataset. Pure and deterministic: no clock, no network,
 * no environment. The orders are made first, from a day-by-day journey each,
 * and everything else (documents, payments, SPRs, tasks, reminders,
 * exceptions) is derived from them, so every screen tells the same story.
 * Each call returns fresh objects a test may change.
 */
export function createSyntheticDataset(
  options: DatasetOptions = {},
): SyntheticDataset {
  const seed = options.seed ?? DEFAULT_SEED;
  const reference = options.referenceDate ?? AS_OF;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reference)) {
    throw new RangeError("The reference date must be YYYY-MM-DD");
  }
  const random = new SeededRandom(seed);
  const people = makePeople();
  const brands = makeBrands();
  const customers = makeCustomers(random);
  const vendors = makeVendors(random);
  const items = makeItems(random, vendors);
  const journeys = planJourneys(random, reference);
  const numberer = new RecordNumberer();
  const orders = makeOrders({
    random,
    reference,
    customers,
    items,
    brands,
    people,
    journeys,
    documents: documentFactory(numberer),
  });
  const sprs = makeSprs(orders, journeys, items, numberer);
  const tasks = makeTasks(orders, customers, sprs, reference);
  return {
    label: SYNTHETIC_LABEL,
    seed,
    asOf: reference,
    people,
    brands,
    customers,
    vendors,
    vendorBankAccounts: makeVendorBankAccounts(vendors),
    items,
    orders,
    payments: makePayments(orders, journeys),
    sprs,
    tasks,
    reminders: makeReminders(tasks, orders, reference),
    exceptions: makeExceptions(orders, journeys, numberer),
    kpis: makeKpis(random, reference, orders, sprs),
    openingBalances: openingBalances(customers, vendors, items),
  };
}

const cache = new Map<string, SyntheticDataset>();

/**
 * The dataset for a reference date (today in Asia/Singapore by default),
 * built once and kept for the day. Callers share it, so they must not change
 * it: use `createSyntheticDataset` for a copy a test may edit.
 */
export function syntheticDataset(
  options: DatasetOptions = {},
): SyntheticDataset {
  const seed = options.seed ?? DEFAULT_SEED;
  const referenceDate = options.referenceDate ?? todayInSingapore();
  const key = `${String(seed)}:${referenceDate}`;
  let dataset = cache.get(key);
  if (!dataset) {
    dataset = createSyntheticDataset({ seed, referenceDate });
    // Yesterday's set is no use once the day has turned over.
    if (cache.size >= 2) cache.clear();
    cache.set(key, dataset);
  }
  return dataset;
}

/** One line for a log: the label and the counts. */
export function describeDataset(dataset: SyntheticDataset): string {
  const count = (list: readonly unknown[]): string => String(list.length);
  return `${dataset.label}: ${count(dataset.customers)} customers, ${count(dataset.vendors)} vendors, ${count(dataset.items)} items, ${count(dataset.orders)} orders, ${count(dataset.payments)} payments, ${count(dataset.sprs)} SPRs, ${count(dataset.tasks)} tasks, ${count(dataset.reminders)} reminders, ${count(dataset.exceptions)} exceptions (seed ${String(dataset.seed)}, as of ${dataset.asOf})`;
}
