import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { server } from "@/test/server";
import OrderDetailPage from "./OrderDetailPage";

// An order's detail page while its timeline is on its way: the page head, the
// facts block and the section cards shimmer. Its own file, so that the page's
// tests stay as their owner wrote them.

describe("an order's detail page while it loads", () => {
  it("shimmers its page head, facts block and section cards, and says it is loading", async () => {
    await i18n.loadNamespaces(["order-tracker", "common", "components"]);
    server.use(
      http.get("*/api/v1/tracker/orders/:orderNo", async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/order-tracker/SO-0007"]}>
          <Routes>
            <Route
              path="/order-tracker/:orderNo"
              element={<OrderDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const region = await screen.findByRole("status");
    expect(region).toHaveTextContent("Loading");
    const blocks = [...region.querySelectorAll('[data-slot="skeleton"]')];
    // Header (2), the facts block (1), two section cards of a head and four lines (10).
    expect(blocks).toHaveLength(13);
    for (const block of blocks) {
      expect(block).toHaveClass("dx-shimmer");
      expect(block).not.toHaveClass("animate-none");
    }
  });
});
