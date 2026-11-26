// Test-only: a small in-memory review queue behind the picture routes.
import type { PictureRefusal, ReviewItem } from "@orderpilot/shared";
import { HttpResponse, http } from "msw";
import { server } from "@/test/server";
import { reviewItem } from "./pictureTestKit";

const NAMES = [
  "Mei Tan",
  "Arjun Rao",
  "Siti Aminah",
  "Linh Tran",
  "Omar Haddad",
];

/** The nth picture of the queue: a made-up person and a made-up id. */
export function pictureItem(
  n: number,
  overrides: Partial<ReviewItem> = {},
): ReviewItem {
  const tail = String(n).padStart(12, "0");
  return reviewItem({
    id: `00000000-0000-4000-8000-${tail}`,
    owner: {
      id: `00000000-0000-4000-9000-${tail}`,
      displayName: NAMES[n % NAMES.length] ?? "Mei Tan",
      email: `person${String(n)}@example.test`,
      role: "SUPPORT",
    },
    ...overrides,
  });
}

export const LIST = "*/api/v1/profile-pictures";

function refusalBody(code: PictureRefusal) {
  return {
    error: {
      code: code === "own_picture" ? "FORBIDDEN" : "CONFLICT",
      message: "server message",
      details: [{ path: "picture", message: code }],
      traceId: "trace-review",
    },
  };
}

export interface ReviewServer {
  items: ReviewItem[];
  /** The query string of every list request, in order. */
  lists: string[];
  /** Every decision the server received. */
  decisions: { id: string; action: string; body: unknown }[];
  /** The next decision is refused with this code, and the picture leaves the list. */
  refuseNext: PictureRefusal | null;
}

/** Serves the list, the count and the three decisions from `items`. */
export function serveReview(items: ReviewItem[]): ReviewServer {
  const state: ReviewServer = {
    items: [...items],
    lists: [],
    decisions: [],
    refuseNext: null,
  };

  function decide(action: string, to: "APPROVED" | null) {
    return async ({
      params,
      request,
    }: {
      params: Record<string, string | readonly string[] | undefined>;
      request: Request;
    }) => {
      const id = String(params.id);
      const text = await request.text();
      state.decisions.push({
        id,
        action,
        body: text === "" ? null : (JSON.parse(text) as unknown),
      });
      const found = state.items.find((item) => item.id === id);
      if (state.refuseNext) {
        const code = state.refuseNext;
        state.refuseNext = null;
        state.items = state.items.filter((item) => item.id !== id);
        return HttpResponse.json(refusalBody(code), {
          status: code === "own_picture" ? 403 : 409,
        });
      }
      if (!found) return HttpResponse.json({}, { status: 404 });
      state.items = state.items.filter((item) => item.id !== id);
      if (to) state.items.push({ ...found, status: to });
      return HttpResponse.json({
        data: { ...found, status: to ?? "REJECTED" },
      });
    };
  }

  server.use(
    http.get(LIST, ({ request }) => {
      const url = new URL(request.url);
      state.lists.push(url.search);
      const status = url.searchParams.get("status") ?? "PENDING";
      const page = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 25);
      const all = state.items.filter((item) => item.status === status);
      return HttpResponse.json({
        data: all.slice((page - 1) * pageSize, page * pageSize),
        meta: { page, pageSize, total: all.length },
      });
    }),
    http.post(`${LIST}/:id/approve`, decide("approve", "APPROVED")),
    http.post(`${LIST}/:id/reject`, decide("reject", null)),
    http.post(`${LIST}/:id/take-down`, decide("take-down", null)),
  );
  return state;
}
