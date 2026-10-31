import { NotFoundException } from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import {
  API_BASE_PATH,
  errorEnvelopeSchema,
  pageQuerySchema,
} from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { renderError } from "./all-exceptions.filter.js";
import { versionedBasePath } from "./api-paths.js";
import {
  ConflictError,
  DomainError,
  NotFoundError,
  ValidationFailedError,
} from "./domain-error.js";
import { InMemoryRepository } from "./repository.js";
import { resolveRequestId } from "./request-id.js";
import { ZodValidationPipe } from "./zod-validation.pipe.js";

describe("the versioned base path", () => {
  it("is the shared API_BASE_PATH", () => {
    expect(versionedBasePath()).toBe(API_BASE_PATH);
  });
});

describe("renderError", () => {
  it("maps a domain error to its code and status", () => {
    const { status, body } = renderError(
      new ConflictError("Already exists."),
      "t-1",
    );
    expect(status).toBe(409);
    expect(body.error).toEqual({
      code: "CONFLICT",
      message: "Already exists.",
      details: null,
      traceId: "t-1",
    });
    expect(renderError(new NotFoundError("Order"), "t").status).toBe(404);
  });

  it("carries field issues for a validation error", () => {
    const { status, body } = renderError(
      new ValidationFailedError([{ path: "qty", message: "Too small" }]),
      "t",
    );
    expect(status).toBe(400);
    expect(body.error.details).toEqual([{ path: "qty", message: "Too small" }]);
  });

  it("maps Nest HTTP exceptions by status", () => {
    expect(
      renderError(new NotFoundException("Cannot GET /x"), "t").body.error,
    ).toMatchObject({
      code: "NOT_FOUND",
      message: "The resource was not found.",
    });
    expect(renderError(new ThrottlerException(), "t")).toMatchObject({
      status: 429,
      body: { error: { code: "RATE_LIMITED" } },
    });
  });

  it("maps a body-parser error by its status", () => {
    const tooLarge = Object.assign(new Error("request entity too large"), {
      status: 413,
    });
    expect(renderError(tooLarge, "t")).toMatchObject({
      status: 413,
      body: {
        error: {
          code: "VALIDATION_FAILED",
          message: "The request body is too large.",
        },
      },
    });
  });

  it("gives a bug a generic message and no details", () => {
    const { status, body } = renderError(
      new Error("connect ECONNREFUSED 10.0.0.5:5432"),
      "t",
    );
    expect(status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
    expect(renderError("a string was thrown", "t").status).toBe(500);
    expect(renderError(undefined, "t").status).toBe(500);
  });

  it("always produces the shared envelope", () => {
    for (const failure of [
      new Error("x"),
      new NotFoundError("A"),
      new NotFoundException(),
      null,
    ]) {
      expect(() =>
        errorEnvelopeSchema.parse(renderError(failure, "t").body),
      ).not.toThrow();
    }
  });

  it("DomainError subclasses report the status the shared table gives their code", () => {
    expect(new DomainError("FORBIDDEN", "No.").httpStatus).toBe(403);
  });
});

describe("ZodValidationPipe", () => {
  const pipe = new ZodValidationPipe(pageQuerySchema);

  it("returns the parsed value, with defaults and coercion applied", () => {
    expect(pipe.transform({ pageSize: "10" })).toEqual({
      page: 1,
      pageSize: 10,
    });
  });

  it("throws a ValidationFailedError naming each field", () => {
    try {
      pipe.transform({ page: "0", pageSize: "500" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationFailedError);
      const paths = (error as ValidationFailedError).details?.map(
        (issue) => issue.path,
      );
      expect(paths).toEqual(["page", "pageSize"]);
    }
  });

  it("names nested fields with dots", () => {
    const nested = new ZodValidationPipe(
      z.object({ lines: z.array(z.object({ qty: z.int() })) }),
    );
    try {
      nested.transform({ lines: [{ qty: "x" }] });
      expect.unreachable();
    } catch (error) {
      expect((error as ValidationFailedError).details?.[0]?.path).toBe(
        "lines.0.qty",
      );
    }
  });
});

describe("resolveRequestId", () => {
  function run(header: string | undefined) {
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (name: string, value: string) => (headers[name] = value),
    };
    const req = {
      headers: header === undefined ? {} : { "x-request-id": header },
    };
    const id = resolveRequestId(req as never, res as never);
    return { id, headers };
  }

  it("keeps a safe caller id and puts it on the response", () => {
    expect(run("abc-123_X.y:z")).toEqual({
      id: "abc-123_X.y:z",
      headers: { "X-Request-Id": "abc-123_X.y:z" },
    });
  });

  it("replaces an empty, long or unsafe id", () => {
    for (const bad of [
      "",
      "x".repeat(129),
      "has space",
      "new\nline",
      "<script>",
    ]) {
      expect(run(bad).id).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(run(undefined).id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("InMemoryRepository (the base repository pattern)", () => {
  interface Widget {
    id: number;
    name: string;
  }
  class WidgetRepository extends InMemoryRepository<Widget, number> {
    protected readonly entityName = "Widget";
    protected idOf(entity: Widget): number {
      return entity.id;
    }
  }

  it("finds by id, and getById throws NotFoundError when missing", async () => {
    const repo = new WidgetRepository();
    repo.save({ id: 1, name: "a" });
    expect(await repo.findById(1)).toEqual({ id: 1, name: "a" });
    expect(await repo.findById(2)).toBeNull();
    await expect(repo.getById(2)).rejects.toThrow(NotFoundError);
    await expect(repo.getById(2)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lists a page with the meta the API returns", async () => {
    const repo = new WidgetRepository();
    for (let id = 1; id <= 5; id += 1)
      repo.save({ id, name: `w${String(id)}` });
    const page = await repo.list({ page: 2, pageSize: 2 });
    expect(page.items.map((w) => w.id)).toEqual([3, 4]);
    expect(page.meta).toEqual({ page: 2, pageSize: 2, total: 5 });
  });
});
