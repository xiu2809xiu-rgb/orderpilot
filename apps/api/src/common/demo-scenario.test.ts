import { syntheticDataset, setDemoStoryline } from "@orderpilot/synthetic-data";
import { afterEach, describe, expect, it } from "vitest";
import { baseEnv } from "../../test/support/base-env.js";
import { AppConfig } from "../config/app-config.js";
import { applyDemoScenario } from "./demo-scenario.js";

const customerOfShortOrder = (): string | undefined =>
  syntheticDataset().orders.find((o) => o.header.no === "SO-0082")?.header
    .sellToCustomerNo;

describe("applyDemoScenario", () => {
  afterEach(() => {
    setDemoStoryline(false);
  });

  it("leaves the generated data alone when DEMO_STORYLINE is off", () => {
    applyDemoScenario(AppConfig.fromEnv(baseEnv()));
    expect(customerOfShortOrder()).not.toBe("C-1042");
  });

  it("puts the storyline in when DEMO_STORYLINE is on, and takes it out again", () => {
    applyDemoScenario(AppConfig.fromEnv(baseEnv({ DEMO_STORYLINE: "true" })));
    expect(customerOfShortOrder()).toBe("C-1042");
    applyDemoScenario(AppConfig.fromEnv(baseEnv()));
    expect(customerOfShortOrder()).not.toBe("C-1042");
  });
});
