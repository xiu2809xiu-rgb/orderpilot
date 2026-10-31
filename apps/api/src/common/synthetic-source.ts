import {
  syntheticDataset,
  type SyntheticDataset,
} from "@orderpilot/synthetic-data";

/**
 * Where the mock read models get their data: a function, so each request sees
 * the set for today in Asia/Singapore (built once a day and kept). "Overdue"
 * and "age" then stay true when the API runs for weeks. Tests pass a function
 * that returns a set with a fixed date.
 */
export type DatasetSource = () => SyntheticDataset;

/** The injection token for the source. */
export const SYNTHETIC_SOURCE = Symbol("SYNTHETIC_SOURCE");

export const currentDataset: DatasetSource = () => syntheticDataset();

export const syntheticSourceProvider = {
  provide: SYNTHETIC_SOURCE,
  useValue: currentDataset,
};
