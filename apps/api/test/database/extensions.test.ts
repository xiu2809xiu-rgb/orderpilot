import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testConfig } from "../support/reset.js";

describe("the PostgreSQL extensions", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: testConfig().database.url });
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
  });

  it("has vector and pg_trgm enabled by the migrations", async () => {
    const { rows } = await client.query<{ extname: string }>(
      `SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pg_trgm') ORDER BY extname`,
    );
    expect(rows.map((r) => r.extname)).toEqual(["pg_trgm", "vector"]);
  });

  it("can store and compare a vector, and score text similarity", async () => {
    const { rows } = await client.query<{ distance: number; score: number }>(
      `SELECT '[1,2,3]'::vector <-> '[1,2,4]'::vector AS distance,
              similarity('Acme Marine Supplies', 'Acme Marine Supply') AS score`,
    );
    expect(rows[0]?.distance).toBeCloseTo(1, 5);
    expect(rows[0]?.score).toBeGreaterThan(0.5);
  });
});
