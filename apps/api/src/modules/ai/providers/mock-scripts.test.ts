import { describe, expect, it } from "vitest";
import {
  GATEWAY_PROBE_FEATURE,
  GATEWAY_PROBE_OBJECT,
  GATEWAY_PROBE_TEXT,
  MockScriptRegistry,
  createProductionMockScripts,
  mockChunks,
  mockJson,
  mockText,
  mockToolCalls,
  type MockScriptContext,
} from "./mock-scripts.js";

const request = {
  feature: GATEWAY_PROBE_FEATURE,
  promptVersion: "v1",
  instructions: "x",
  messages: [],
  tools: [],
  maxOutputTokens: 10,
} as const;

const context = (jsonOutput: boolean): MockScriptContext => ({
  request: jsonOutput
    ? { ...request, jsonOutput: { name: "probe", schema: { type: "object" } } }
    : request,
  turn: 0,
  userText: "",
  toolResults: [],
});

describe("the reply builders", () => {
  it("make each kind of reply a script can give", () => {
    expect(mockText("hi")).toEqual({ kind: "text", text: "hi" });
    expect(mockChunks("a", "b")).toEqual({
      kind: "chunks",
      chunks: ["a", "b"],
    });
    expect(mockJson({ a: 1 })).toEqual({ kind: "json", value: { a: 1 } });
    expect(mockToolCalls([{ name: "t", input: { q: 1 } }])).toEqual({
      kind: "tool-calls",
      calls: [{ name: "t", input: { q: 1 } }],
    });
    expect(mockToolCalls([{ name: "t", input: {} }], "Looking")).toMatchObject({
      text: "Looking",
    });
  });
});

describe("the script registry", () => {
  it("returns the script registered for a feature, and nothing for another", () => {
    const registry = new MockScriptRegistry().register("demo", () =>
      mockText("a"),
    );
    expect(registry.get("demo")?.(context(false))).toEqual(mockText("a"));
    expect(registry.get("other")).toBeUndefined();
    expect(registry.features()).toEqual(["demo"]);
  });

  it("refuses a second script for the same feature, so one cannot hide another", () => {
    const registry = new MockScriptRegistry().register("demo", () =>
      mockText("a"),
    );
    expect(() => registry.register("demo", () => mockText("b"))).toThrow(
      '"demo" is already registered',
    );
  });

  it.each(["", "Demo", "1demo", "has space", "under_score", "a".repeat(61)])(
    "refuses the feature name %j",
    (name) => {
      expect(() =>
        new MockScriptRegistry().register(name, () => mockText("")),
      ).toThrow(RangeError);
    },
  );

  it("keeps each registry to itself, so one test's scripts never leak into another", () => {
    new MockScriptRegistry().register("only-here", () => mockText("a"));
    expect(new MockScriptRegistry().features()).toEqual([]);
  });
});

describe("the production registry", () => {
  it("holds only gateway-probe", () => {
    expect(createProductionMockScripts().features()).toEqual(["gateway-probe"]);
  });

  it("answers the probe with text, or with a small object when JSON is asked for", () => {
    const script = createProductionMockScripts().get(GATEWAY_PROBE_FEATURE);
    expect(script?.(context(false))).toEqual(mockText(GATEWAY_PROBE_TEXT));
    expect(script?.(context(true))).toEqual(mockJson(GATEWAY_PROBE_OBJECT));
  });

  it("is a new registry each time", () => {
    expect(createProductionMockScripts()).not.toBe(
      createProductionMockScripts(),
    );
  });
});
