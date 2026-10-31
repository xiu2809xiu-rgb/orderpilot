import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { Permission } from "@orderpilot/shared";
import {
  AUTHENTICATED_KEY,
  PERMISSION_KEY,
  PUBLIC_KEY,
} from "../decorators.js";

/** What a route's decorators say about who may call it. */
export type Access =
  | { readonly kind: "public" }
  | { readonly kind: "authenticated" }
  | { readonly kind: "permission"; readonly permissions: Permission[] }
  /** Nobody said. The permissions guard refuses it: deny by default. */
  | { readonly kind: "unclassified" };

/**
 * Reads the decorators of the handler first, then of its controller, and takes
 * the first level that says anything. All three guards use this one function,
 * so they never disagree about a route.
 */
export function accessOf(
  reflector: Reflector,
  context: ExecutionContext,
): Access {
  for (const target of [context.getHandler(), context.getClass()]) {
    if (reflector.get<boolean | undefined>(PUBLIC_KEY, target)) {
      return { kind: "public" };
    }
    const permissions = reflector.get<Permission[] | undefined>(
      PERMISSION_KEY,
      target,
    );
    if (permissions) return { kind: "permission", permissions };
    if (reflector.get<boolean | undefined>(AUTHENTICATED_KEY, target)) {
      return { kind: "authenticated" };
    }
  }
  return { kind: "unclassified" };
}
