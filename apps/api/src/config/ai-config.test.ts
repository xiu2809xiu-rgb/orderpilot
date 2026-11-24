import { describe, expect, it } from "vitest";
import { baseEnv } from "../../test/support/base-env.js";
import { AppConfig } from "./app-config.js";
import { ConfigError } from "./config-error.js";

const valid = baseEnv();
const key = "sk-live-SECRET-0123456789";

function messageFor(env: NodeJS.ProcessEnv): string {
  try {
    AppConfig.fromEnv(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return (error as ConfigError).message;
  }
  throw new Error("expected a ConfigError");
}

/** A URL with a login in it, built here so the source holds no credential-shaped text. */
function withLogin(url: string, password: string): string {
  const parsed = new URL(url);
  parsed.username = "user";
  parsed.password = password;
  return parsed.href;
}

describe("AI settings", () => {
  it("default to the offline mock, with no key, model or address", () => {
    const { ai } = AppConfig.fromEnv(valid);
    expect(ai).toEqual({
      provider: "mock",
      kind: "mock",
      apiKey: null,
      baseUrl: null,
      model: null,
      visionModel: null,
      structuredOutput: "json_schema",
      timeoutMs: 60_000,
      maxAttempts: 3,
      maxToolSteps: 5,
      maxImagesPerRequest: 3,
      maxOutputTokens: 4096,
      priceInputUsdPerMtok: "0",
      priceOutputUsdPerMtok: "0",
      bedrock: null,
    });
  });

  it("treat an empty or blank value as unset, as compose passes it", () => {
    const { ai } = AppConfig.fromEnv({
      ...valid,
      AI_PROVIDER: "",
      GROQ_API_KEY: "",
      AI_MODEL: "  ",
      AI_TIMEOUT_MS: "",
      AI_STRUCTURED_OUTPUT: "",
      AI_PRICE_INPUT_USD_PER_MTOK: "",
    });
    expect(ai.provider).toBe("mock");
    expect(ai.timeoutMs).toBe(60_000);
    expect(ai.structuredOutput).toBe("json_schema");
    expect(ai.priceInputUsdPerMtok).toBe("0");
  });

  it("read gemini and groq as presets, which the policy sees as openai-compatible", () => {
    const gemini = AppConfig.fromEnv({
      ...valid,
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: key,
      AI_MODEL: "model-a",
    }).ai;
    expect(gemini).toMatchObject({
      provider: "gemini",
      kind: "openai-compatible",
      apiKey: key,
      baseUrl: null,
      model: "model-a",
      visionModel: "model-a",
    });
    const groq = AppConfig.fromEnv({
      ...valid,
      AI_PROVIDER: "groq",
      GROQ_API_KEY: key,
      AI_MODEL: "model-b",
      AI_VISION_MODEL: "model-v",
      GEMINI_API_KEY: "another-SECRET",
    }).ai;
    expect(groq).toMatchObject({
      provider: "groq",
      kind: "openai-compatible",
      apiKey: key,
      visionModel: "model-v",
    });
  });

  it("read an openai-compatible server, with or without a key", () => {
    const local = AppConfig.fromEnv({
      ...valid,
      AI_PROVIDER: "openai-compatible",
      AI_BASE_URL: "http://localhost:11434/v1",
      AI_MODEL: "model-c",
    }).ai;
    expect(local).toMatchObject({
      kind: "openai-compatible",
      baseUrl: "http://localhost:11434/v1",
      apiKey: null,
    });
  });

  it("read Bedrock, with its own credentials and an optional session token", () => {
    const { ai } = AppConfig.fromEnv({
      ...valid,
      AI_PROVIDER: "bedrock",
      AI_MODEL: "model-d",
      AI_BEDROCK_REGION: "ap-southeast-1",
      AI_BEDROCK_ACCESS_KEY_ID: "AKIA-SECRET",
      AI_BEDROCK_SECRET_ACCESS_KEY: key,
    });
    expect(ai.kind).toBe("bedrock");
    expect(ai.apiKey).toBeNull();
    expect(ai.bedrock).toEqual({
      region: "ap-southeast-1",
      accessKeyId: "AKIA-SECRET",
      secretAccessKey: key,
      sessionToken: null,
    });
  });

  it("read the limits and the prices", () => {
    const { ai } = AppConfig.fromEnv({
      ...valid,
      AI_TIMEOUT_MS: "30000",
      AI_MAX_ATTEMPTS: "2",
      AI_MAX_TOOL_STEPS: "8",
      AI_MAX_IMAGES_PER_REQUEST: "5",
      AI_MAX_OUTPUT_TOKENS: "2048",
      AI_STRUCTURED_OUTPUT: "prompt",
      AI_PRICE_INPUT_USD_PER_MTOK: "0.15",
      AI_PRICE_OUTPUT_USD_PER_MTOK: "0.6",
    });
    expect(ai).toMatchObject({
      timeoutMs: 30_000,
      maxAttempts: 2,
      maxToolSteps: 8,
      maxImagesPerRequest: 5,
      maxOutputTokens: 2048,
      structuredOutput: "prompt",
      priceInputUsdPerMtok: "0.15",
      priceOutputUsdPerMtok: "0.6",
    });
  });

  it.each([
    ["AI_PROVIDER", "anthropic"],
    ["AI_STRUCTURED_OUTPUT", "xml"],
    ["AI_TIMEOUT_MS", "10"],
    ["AI_MAX_ATTEMPTS", "0"],
    ["AI_MAX_ATTEMPTS", "9"],
    ["AI_MAX_TOOL_STEPS", "50"],
    ["AI_MAX_IMAGES_PER_REQUEST", "0"],
    ["AI_PRICE_INPUT_USD_PER_MTOK", "-1"],
    ["AI_PRICE_OUTPUT_USD_PER_MTOK", "cheap"],
    ["AI_BASE_URL", "not a url"],
    ["AI_BASE_URL", "ftp://example.test/v1"],
    ["AI_BASE_URL", withLogin("https://example.test/v1", "pass")],
  ])("refuse %s=%s, and name the variable", (name, value) => {
    expect(messageFor({ ...valid, [name]: value })).toContain(`${name}:`);
  });
});

describe("a chosen AI provider with something missing", () => {
  const rules: [string, Record<string, string>, string[]][] = [
    ["gemini", { AI_PROVIDER: "gemini" }, ["GEMINI_API_KEY", "AI_MODEL"]],
    ["groq", { AI_PROVIDER: "groq" }, ["GROQ_API_KEY", "AI_MODEL"]],
    [
      "openai-compatible",
      { AI_PROVIDER: "openai-compatible" },
      ["AI_BASE_URL", "AI_MODEL"],
    ],
    [
      "bedrock",
      { AI_PROVIDER: "bedrock" },
      [
        "AI_BEDROCK_REGION",
        "AI_BEDROCK_ACCESS_KEY_ID",
        "AI_BEDROCK_SECRET_ACCESS_KEY",
        "AI_MODEL",
      ],
    ],
  ];

  it.each(rules)(
    "%s fails start-up naming each variable and the file",
    (_name, env, missing) => {
      const message = messageFor({ ...valid, ...env });
      for (const variable of missing) {
        expect(message).toContain(`${variable}: is missing.`);
      }
      expect(message).toContain("root .env file");
    },
  );

  it("counts an empty key as missing", () => {
    const message = messageFor({
      ...valid,
      AI_PROVIDER: "groq",
      GROQ_API_KEY: "",
      AI_MODEL: "model-b",
    });
    expect(message).toContain("GROQ_API_KEY");
  });

  it("does not ask for the key of a provider that was not chosen", () => {
    expect(() =>
      AppConfig.fromEnv({
        ...valid,
        AI_PROVIDER: "groq",
        GROQ_API_KEY: key,
        AI_MODEL: "model-b",
      }),
    ).not.toThrow();
  });

  it("never lets a key, a model id or an address into a thrown message", () => {
    const secrets = [
      key,
      "AKIA-SECRET-ID",
      "SECRET-HOST",
      "SECRET-MODEL-ID",
      "SECRET-TIMEOUT",
      "SECRET-PASS",
    ];
    const messages = [
      messageFor({
        ...valid,
        AI_PROVIDER: "groq",
        GROQ_API_KEY: key,
        AI_MODEL: "SECRET-MODEL-ID",
        AI_TIMEOUT_MS: "SECRET-TIMEOUT",
      }),
      messageFor({
        ...valid,
        AI_PROVIDER: "bedrock",
        AI_BEDROCK_ACCESS_KEY_ID: "AKIA-SECRET-ID",
        AI_BEDROCK_SECRET_ACCESS_KEY: key,
      }),
      messageFor({
        ...valid,
        AI_PROVIDER: "openai-compatible",
        AI_API_KEY: key,
        AI_BASE_URL: "ftp://SECRET-HOST.example.test/v1",
        AI_MODEL: "SECRET-MODEL-ID",
      }),
      messageFor({
        ...valid,
        AI_BASE_URL: withLogin(
          "https://SECRET-HOST.example.test/v1",
          "SECRET-PASS",
        ),
        AI_API_KEY: key,
      }),
    ];
    for (const message of messages) {
      for (const secret of secrets) expect(message).not.toContain(secret);
    }
  });
});

describe("AI settings in production", () => {
  const production = baseEnv({
    APP_ENV: "production",
    CORS_ORIGINS: "https://app.example.com",
    JWT_SECRET: "a-long-random-secret-for-this-test-only-0123456789",
    DATA_ORIGIN: "synthetic",
    AI_PROVIDER: "openai-compatible",
    AI_MODEL: "model-c",
  });

  it("accept an https address", () => {
    expect(
      AppConfig.fromEnv({
        ...production,
        AI_BASE_URL: "https://llm.example.com/v1",
      }).ai.baseUrl,
    ).toBe("https://llm.example.com/v1");
  });

  it("refuse an http address, naming the variable and not the address", () => {
    const message = messageFor({
      ...production,
      AI_BASE_URL: "http://llm.example.com/v1",
    });
    expect(message).toContain("AI_BASE_URL");
    expect(message).toContain("https");
    expect(message).not.toContain("llm.example.com");
  });

  it.each([
    "http://localhost:11434/v1",
    "http://127.0.0.1:11434/v1",
    "http://127.0.0.2:8080/v1",
    "http://[::1]:11434/v1",
  ])("allow http on this machine: %s", (url) => {
    expect(() =>
      AppConfig.fromEnv({ ...production, AI_BASE_URL: url }),
    ).not.toThrow();
  });

  it("do not treat a look-alike host as this machine", () => {
    expect(
      messageFor({
        ...production,
        AI_BASE_URL: "http://localhost.example.com/v1",
      }),
    ).toContain("AI_BASE_URL");
  });

  it("allow http away from production", () => {
    expect(() =>
      AppConfig.fromEnv({
        ...production,
        APP_ENV: "demo",
        COOKIE_SECURE: "true",
        AI_BASE_URL: "http://llm.example.com/v1",
      }),
    ).not.toThrow();
  });
});
