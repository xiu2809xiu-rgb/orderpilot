import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { QueryBoundary } from "./QueryBoundary";

const failed = (error: unknown) => ({
  isPending: false,
  isError: true,
  error,
  refetch: () => undefined,
});

describe("QueryBoundary", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["components", "common"]);
  });

  it("shows a refusal with its trace id, so the person can quote it", () => {
    render(
      <QueryBoundary
        query={failed(
          new ApiError("FORBIDDEN", "refused", 403, "trace-refused-1"),
        )}
      >
        <p>never shown</p>
      </QueryBoundary>,
    );
    expect(screen.getByText("You do not have access to this")).toBeVisible();
    expect(screen.getByText("trace-refused-1")).toBeVisible();
    expect(screen.queryByText("never shown")).toBeNull();
  });
});
