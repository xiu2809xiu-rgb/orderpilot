// The auth route contract: the API (P-10) implements it, the web app (P-11)
// calls it. Paths are relative to API_BASE_PATH.

import { z } from "zod";
import { sessionSchema } from "./identity.js";
import { roleSchema, type Role } from "./roles.js";

export const API_BASE_PATH = "/api/v1";

export const COOKIES = {
  /** httpOnly. The JWT access token. */
  access: "op_access",
  /** httpOnly, and sent only to the auth path. */
  refresh: "op_refresh",
  /** Readable by script, so the web app can copy it into the header. */
  csrf: "op_csrf",
} as const;

/** The refresh cookie's Path attribute. */
export const REFRESH_COOKIE_PATH = `${API_BASE_PATH}/auth`;

export const HEADERS = {
  csrf: "X-CSRF-Token",
  requestId: "X-Request-Id",
} as const;

/** Synthetic names for the demo sign-in, one per role. */
export const DEMO_PERSONAS: Record<Role, string> = {
  SYSTEM_ADMIN: "Daniel Koh",
  PRODUCT_MANAGER: "Priya Nair",
  APPROVER: "Janet Lim",
  SUPPORT: "Mei Tan",
  WAREHOUSE: "Hafiz Rahman",
  FINANCE: "Grace Ong",
  LOGISTICS: "Arjun Mehta",
  MANAGEMENT: "Sophia Chen",
  AUDITOR: "Lucas Wong",
};

export const authOptionsSchema = z.object({
  demoMode: z.boolean(),
  // Empty when demoMode is false.
  demoRoles: z.array(
    z.object({ role: roleSchema, displayName: z.string().min(1) }),
  ),
});
export type AuthOptions = z.infer<typeof authOptionsSchema>;

export const demoLoginRequestSchema = z.object({ role: roleSchema });
export type DemoLoginRequest = z.infer<typeof demoLoginRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(256),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const sessionResponseSchema = z.object({ data: sessionSchema });
export const authOptionsResponseSchema = z.object({ data: authOptionsSchema });
export const logoutResponseSchema = z.object({
  data: z.object({ ok: z.literal(true) }),
});

type Method = "GET" | "POST";

interface Route<Req extends z.ZodType | null, Res extends z.ZodType> {
  method: Method;
  path: string;
  /** True when a state-changing call must send the CSRF header. */
  csrf: boolean;
  request: Req;
  response: Res;
}

function route<Req extends z.ZodType | null, Res extends z.ZodType>(
  r: Route<Req, Res>,
): Route<Req, Res> {
  return r;
}

export const authRoutes = {
  options: route({
    method: "GET",
    path: "/auth/options",
    csrf: false,
    request: null,
    response: authOptionsResponseSchema,
  }),
  demoLogin: route({
    method: "POST",
    path: "/auth/demo-login",
    csrf: false,
    request: demoLoginRequestSchema,
    response: sessionResponseSchema,
  }),
  login: route({
    method: "POST",
    path: "/auth/login",
    csrf: false,
    request: loginRequestSchema,
    response: sessionResponseSchema,
  }),
  // No body: the refresh cookie is the credential.
  refresh: route({
    method: "POST",
    path: "/auth/refresh",
    csrf: true,
    request: null,
    response: sessionResponseSchema,
  }),
  logout: route({
    method: "POST",
    path: "/auth/logout",
    csrf: true,
    request: null,
    response: logoutResponseSchema,
  }),
  me: route({
    method: "GET",
    path: "/auth/me",
    csrf: false,
    request: null,
    response: sessionResponseSchema,
  }),
} as const;

/** The full URL path for a route, such as /api/v1/auth/me. */
export function apiPath(path: string): string {
  return `${API_BASE_PATH}${path}`;
}
