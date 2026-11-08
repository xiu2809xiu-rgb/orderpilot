import { ROLES } from "@orderpilot/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionFor } from "@/test/fixtures";
import { menuFor } from "./nav";
import {
  allFeatures,
  features,
  reachableFeatures,
  showPlannedFeatures,
} from "./registry";

const planned = allFeatures.filter((feature) => feature.planned);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("planned features", () => {
  it("are the four that still render a placeholder", () => {
    expect(planned.map((f) => f.id).sort()).toEqual([
      "connectors",
      "constellation",
      "documents",
      "mapping",
    ]);
  });

  it("are left out of the registry and so out of every menu", () => {
    const reachable = reachableFeatures(allFeatures, false);
    for (const feature of planned) expect(reachable).not.toContain(feature);
    for (const role of ROLES) {
      const paths = menuFor(sessionFor(role), reachable).map((e) => e.to);
      for (const feature of planned) {
        expect(paths).not.toContain(`/${feature.path}`);
      }
    }
  });

  it("come back with the developer flag", () => {
    const withPlanned = reachableFeatures(allFeatures, true);
    for (const feature of planned) expect(withPlanned).toContain(feature);
    const admin = menuFor(sessionFor("SYSTEM_ADMIN"), withPlanned);
    expect(admin.map((e) => e.to)).toEqual(
      expect.arrayContaining(["/mapping", "/connectors"]),
    );
  });

  it("need a development build as well as the flag", () => {
    vi.stubEnv("VITE_SHOW_PLANNED", "true");
    vi.stubEnv("DEV", true);
    expect(showPlannedFeatures()).toBe(true);
    vi.stubEnv("DEV", false);
    expect(showPlannedFeatures()).toBe(false);
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_SHOW_PLANNED", "false");
    expect(showPlannedFeatures()).toBe(false);
  });

  it("are off in a test run unless the test turns them on", () => {
    expect(features.some((f) => f.planned)).toBe(false);
  });
});
