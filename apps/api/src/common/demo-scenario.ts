import { setDemoStoryline } from "@orderpilot/synthetic-data";
import type { AppConfig } from "../config/app-config.js";

/**
 * Applies the DEMO_STORYLINE setting to the sample data. Every process entry
 * that can read the data calls it once, right after the configuration is
 * built and before anything reads the data, so that even the first reader (the
 * seed, which stores tasks and records made from it) sees the storyline.
 */
export function applyDemoScenario(config: AppConfig): void {
  setDemoStoryline(config.demoStoryline);
}
