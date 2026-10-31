import { createSyntheticDataset } from "@orderpilot/synthetic-data";

/** The injection token for the synthetic dataset behind the mock routes. */
export const SYNTHETIC_DATASET = Symbol("SYNTHETIC_DATASET");

/** Built once per process: the data is fixed by its seed, so a call returns the same set. */
export const syntheticDatasetProvider = {
  provide: SYNTHETIC_DATASET,
  useFactory: () => createSyntheticDataset(),
};
