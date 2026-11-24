// Test-only: the owner's picture answers and the reviewers' list, as the API gives them.
import type { MyPicture, ReviewItem } from "@orderpilot/shared";
import { HttpResponse, http } from "msw";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";

/** The one moment every picture test measures from. */
export const NOON = "2026-11-24T04:00:00.000Z";
export const PENDING_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
export const APPROVED_ID = "3f2c1a40-6b7d-4e0a-9f1b-2d4c6e8a0b11";

export const MINE = "*/api/v1/profile-pictures/mine";

export function emptyPicture(used = 0): MyPicture {
  return {
    approved: null,
    pending: null,
    notice: null,
    uploads: { used, limit: 10 },
  };
}

export function pendingPicture(
  status: "CHECKED" | "NOT_ALLOWED" | "NOT_RUN" = "NOT_ALLOWED",
): MyPicture {
  return {
    ...emptyPicture(1),
    pending: { id: PENDING_ID, createdAt: NOON, ai: { status } },
  };
}

export function approvedPicture(): MyPicture {
  return {
    ...emptyPicture(1),
    approved: { id: APPROVED_ID, decidedAt: NOON },
  };
}

/** The owner's route answers with this. */
export function answerMine(data: MyPicture) {
  server.use(http.get(MINE, () => HttpResponse.json({ data })));
}

export function failMine(traceId = "trace-picture-card") {
  server.use(
    http.get(MINE, () =>
      HttpResponse.json(errorBody("INTERNAL_ERROR", traceId), { status: 500 }),
    ),
  );
}

export function reviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: PENDING_ID,
    status: "PENDING",
    createdAt: NOON,
    decidedAt: null,
    width: 256,
    byteSize: 20_480,
    owner: {
      id: "00000000-0000-4000-8000-000000000004",
      displayName: "Mei Tan",
      email: "support@example.test",
      role: "SUPPORT",
    },
    ai: {
      status: "NOT_ALLOWED",
      verdict: null,
      concerns: [],
      note: null,
      why: "synthetic-data-only",
    },
    ...overrides,
  };
}
