import type { TFunction } from "i18next";
import { ApiError, ContractError, NetworkError, traceIdOf } from "./api/errors";

/** A message for a person, and the trace id to quote. All text is from `common`. */
export function describeError(
  error: unknown,
  t: TFunction,
): { message: string; traceId: string | undefined } {
  const traceId = traceIdOf(error);
  if (error instanceof ApiError) {
    return { message: t(`errors.codes.${error.code}`), traceId };
  }
  if (error instanceof NetworkError) {
    return { message: t("errors.network"), traceId };
  }
  if (error instanceof ContractError) {
    return { message: t("errors.contract"), traceId };
  }
  return { message: t("errors.unknown"), traceId };
}

/** Only an in-app path may follow a sign-in. Anything else goes home. */
export function safeNext(next: string | null): string {
  if (
    !next?.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return "/";
  }
  return next.startsWith("/login") ? "/" : next;
}
