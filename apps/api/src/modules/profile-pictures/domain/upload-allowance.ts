import type { PictureRefusal } from "@orderpilot/shared";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export type AllowanceJudgement =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: Extract<PictureRefusal, "upload_limit">;
    };

/**
 * How many pictures a person may store in a rolling 24 hours. The count is of
 * stored uploads: a refused file costs one parse and is not counted. A row
 * exactly 24 hours old no longer counts, so `windowStart` is the exclusive end.
 */
export class UploadAllowance {
  /** Rows created strictly after this moment are inside the window. */
  windowStart(now: Date): Date {
    return new Date(now.getTime() - WINDOW_MS);
  }

  judge(used: number, limit: number): AllowanceJudgement {
    return used >= limit ? { ok: false, code: "upload_limit" } : { ok: true };
  }
}
