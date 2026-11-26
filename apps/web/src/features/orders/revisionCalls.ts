import type { CreateSalesOrderBody } from "@orderpilot/shared";
import {
  poVersionsConfirm,
  poVersionsPreview,
} from "@/lib/api/generated/endpoints/orders/orders";
import type { PoVersionsConfirm201Data } from "@/lib/api/generated/model";
import { revisionFailureOf, type RevisionFailure } from "./revisionFailure";
import type { RevisionPhase } from "./revisionRun";

/**
 * What the server says a body would change, as the phase the panel is in. A plain
 * call and not a query hook, so a refetch elsewhere never sends it again.
 */
export async function previewRevision(
  orderNo: string,
  body: CreateSalesOrderBody,
): Promise<RevisionPhase> {
  try {
    const { data } = await poVersionsPreview(orderNo, body);
    return data.identical
      ? { kind: "identical", data }
      : { kind: "ready", data, failure: null };
  } catch (error) {
    return { kind: "previewFailed", failure: revisionFailureOf(error) };
  }
}

/** Confirms the body that was previewed, with the number it was compared with. */
export async function confirmRevision(
  orderNo: string,
  body: CreateSalesOrderBody,
  expectedPoVersionNo: number,
): Promise<
  | { ok: true; answer: PoVersionsConfirm201Data }
  | { ok: false; failure: RevisionFailure }
> {
  try {
    const { data } = await poVersionsConfirm(orderNo, {
      ...body,
      confirmed: true,
      expectedPoVersionNo,
    });
    return { ok: true, answer: data };
  } catch (error) {
    return { ok: false, failure: revisionFailureOf(error) };
  }
}
