import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { getSystemChecksMockHandler } from "@/lib/api/generated/endpoints/system/system.msw";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";
import { ServiceChecksCard } from "./ServiceChecksCard";

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ServiceChecksCard />
    </QueryClientProvider>,
  );
}

describe("ServiceChecksCard (the generated hook pattern)", () => {
  it("shows what the generated mock handler answers", async () => {
    server.use(
      getSystemChecksMockHandler({
        data: [{ name: "database" }, { name: "redis" }],
        meta: { page: 1, pageSize: 25, total: 2 },
      }),
    );
    renderCard();
    expect(await screen.findByText("database")).toBeInTheDocument();
    expect(screen.getByText("redis")).toBeInTheDocument();
  });

  it("sends the request id and shows the trace id of an API error", async () => {
    let requestId: string | null = null;
    server.use(
      http.get("*/api/v1/system/checks", ({ request }) => {
        requestId = request.headers.get("x-request-id");
        return HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-card-1"), {
          status: 500,
        });
      }),
    );
    renderCard();
    expect(await screen.findByRole("alert")).toHaveTextContent("trace-card-1");
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("offers a retry that asks again and shows the checks when they come", async () => {
    let calls = 0;
    server.use(
      http.get("*/api/v1/system/checks", () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            errorBody("INTERNAL_ERROR", "trace-card-2"),
            {
              status: 500,
            },
          );
        }
        return HttpResponse.json({
          data: [{ name: "storage" }],
          meta: { page: 1, pageSize: 25, total: 1 },
        });
      }),
    );
    renderCard();
    expect(await screen.findByRole("alert")).toHaveTextContent("trace-card-2");
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("storage")).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});
