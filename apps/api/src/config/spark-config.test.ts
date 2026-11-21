import { describe, expect, it } from "vitest";
import { AppConfig } from "./app-config.js";

// The smallest environment the schema accepts, with no secret in it.
const BASE: NodeJS.ProcessEnv = {
  APP_ENV: "local",
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user@127.0.0.1:5432/db",
  REDIS_URL: "redis://127.0.0.1:6379/0",
  S3_ACCESS_KEY_ID: "id",
  S3_SECRET_ACCESS_KEY: "secret",
  S3_BUCKET: "a-test-bucket",
};

describe("Spark's settings", () => {
  it("declares the data synthetic when DATA_ORIGIN is not set, or is blank", () => {
    expect(AppConfig.fromEnv(BASE).dataOrigin).toBe("synthetic");
    expect(AppConfig.fromEnv({ ...BASE, DATA_ORIGIN: "" }).dataOrigin).toBe(
      "synthetic",
    );
  });

  it("reads real when DATA_ORIGIN says real", () => {
    expect(AppConfig.fromEnv({ ...BASE, DATA_ORIGIN: "real" }).dataOrigin).toBe(
      "real",
    );
  });

  it("refuses to start on any other word, naming the variable and not the value", () => {
    expect(() =>
      AppConfig.fromEnv({ ...BASE, DATA_ORIGIN: "Synthetic-ish" }),
    ).toThrow(/DATA_ORIGIN/);
    try {
      AppConfig.fromEnv({ ...BASE, DATA_ORIGIN: "Synthetic-ish" });
    } catch (error) {
      expect(String(error)).not.toContain("Synthetic-ish");
    }
  });

  it("limits the questions to 6 a minute and 100 a day unless told otherwise", () => {
    expect(AppConfig.fromEnv(BASE).spark).toEqual({
      questionsPerMinute: 6,
      questionsPerDay: 100,
    });
    expect(
      AppConfig.fromEnv({
        ...BASE,
        SPARK_QUESTIONS_PER_MINUTE: "2",
        SPARK_QUESTIONS_PER_DAY: "10",
      }).spark,
    ).toEqual({ questionsPerMinute: 2, questionsPerDay: 10 });
  });

  it("refuses a limit that is not a positive whole number", () => {
    for (const value of ["0", "-1", "1.5", "many"]) {
      expect(() =>
        AppConfig.fromEnv({ ...BASE, SPARK_QUESTIONS_PER_DAY: value }),
      ).toThrow(/SPARK_QUESTIONS_PER_DAY/);
    }
  });
});
