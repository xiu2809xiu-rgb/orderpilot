// The two-step verification contract (ADR 0068): the API implements it, the
// web app calls it by hand with apiClient.call. Paths are relative to
// API_BASE_PATH. The sign-in step (verify) is the only public route; the rest
// need a session. A secret (a setup key, a recovery code) is only ever in the
// body of an answer of setup, enable or recovery-codes, never in a URL.

import { z } from "zod";
import { TWO_STEP_VERIFY_PATH } from "./auth-routes.js";
import { sessionSchema } from "./identity.js";

export const TWO_STEP_CODE_LENGTH = 6;
export const TWO_STEP_SETUP_MINUTES = 10;
export const RECOVERY_CODE_COUNT = 10;

export const twoStepCodeSchema = z.string().regex(/^\d{6}$/);
/** A recovery code as typed: the server normalises case, spaces and hyphens. */
export const recoveryCodeInputSchema = z.string().min(10).max(40);

const proofFields = {
  code: twoStepCodeSchema.optional(),
  recoveryCode: recoveryCodeInputSchema.optional(),
};

/** Exactly one of a code and a recovery code. */
function exactlyOneProof(value: { code?: unknown; recoveryCode?: unknown }) {
  return (value.code === undefined) !== (value.recoveryCode === undefined);
}
const oneProofIssue = {
  message: "Send a code or a recovery code, not both.",
  path: ["code"],
};

export const twoStepVerifyRequestSchema = z
  .object(proofFields)
  .refine(exactlyOneProof, oneProofIssue);
export type TwoStepVerifyRequest = z.infer<typeof twoStepVerifyRequestSchema>;

export const twoStepStatusSchema = z.object({
  state: z.enum(["off", "on"]),
  hasPassword: z.boolean(),
  /** The server's DEMO_MODE: the card mentions the demo buttons only where they exist. */
  demoSignInSkips: z.boolean(),
  /** True for a demo session whose role holds users.manage: setup is refused (ADR 0068). */
  demoAdminBlocked: z.boolean(),
  enabledAt: z.iso.datetime().nullable(),
  /** Null while off. */
  recoveryCodesLeft: z.number().int().nonnegative().nullable(),
  /** When a lock was last placed, if within 7 days; else null. */
  lastLockedAt: z.iso.datetime().nullable(),
});
export type TwoStepStatus = z.infer<typeof twoStepStatusSchema>;
export const twoStepStatusResponseSchema = z.object({
  data: twoStepStatusSchema,
});

export const twoStepSetupRequestSchema = z.object({
  /** Required for a password session, ignored for a demo session. */
  password: z.string().min(1).max(256).optional(),
});
export type TwoStepSetupRequest = z.infer<typeof twoStepSetupRequestSchema>;
export const twoStepSetupResponseSchema = z.object({
  data: z.object({
    /** Base32 without padding: 20 bytes. */
    setupKey: z.string().length(32),
    otpauthUri: z.string().startsWith("otpauth://totp/"),
    expiresAt: z.iso.datetime(),
  }),
});

export const twoStepEnableRequestSchema = z.object({ code: twoStepCodeSchema });
export const recoveryCodesResponseSchema = z.object({
  data: z.object({
    recoveryCodes: z.array(z.string()).length(RECOVERY_CODE_COUNT),
    status: twoStepStatusSchema,
  }),
});

export const twoStepDisableRequestSchema = z
  .object({
    password: z.string().min(1).max(256).optional(),
    ...proofFields,
  })
  .refine(exactlyOneProof, oneProofIssue);
export type TwoStepDisableRequest = z.infer<typeof twoStepDisableRequestSchema>;

/** A current code only: a recovery code is not accepted for new recovery codes. */
export const twoStepNewCodesRequestSchema = z.object({
  code: twoStepCodeSchema,
});

export const twoStepVerifyResponseSchema = z.object({
  data: sessionSchema,
  meta: z.object({
    method: z.enum(["code", "recovery-code"]),
    recoveryCodesLeft: z.number().int().nonnegative(),
    /** A lock was placed in the last 7 days, even if a success cleared it since. */
    lockedRecently: z.boolean(),
  }),
});
export type TwoStepVerifyResponse = z.infer<typeof twoStepVerifyResponseSchema>;

interface TwoStepRoute<Req extends z.ZodType | null, Res extends z.ZodType> {
  method: "GET" | "POST";
  path: string;
  /** True when the call must send the CSRF header. */
  csrf: boolean;
  request: Req;
  response: Res;
}

function twoStepRoute<Req extends z.ZodType | null, Res extends z.ZodType>(
  r: TwoStepRoute<Req, Res>,
): TwoStepRoute<Req, Res> {
  return r;
}

export const twoStepRoutes = {
  status: twoStepRoute({
    method: "GET",
    path: "/auth/two-step",
    csrf: false,
    request: null,
    response: twoStepStatusResponseSchema,
  }),
  setup: twoStepRoute({
    method: "POST",
    path: "/auth/two-step/setup",
    csrf: true,
    request: twoStepSetupRequestSchema,
    response: twoStepSetupResponseSchema,
  }),
  enable: twoStepRoute({
    method: "POST",
    path: "/auth/two-step/enable",
    csrf: true,
    request: twoStepEnableRequestSchema,
    response: recoveryCodesResponseSchema,
  }),
  disable: twoStepRoute({
    method: "POST",
    path: "/auth/two-step/disable",
    csrf: true,
    request: twoStepDisableRequestSchema,
    response: twoStepStatusResponseSchema,
  }),
  newCodes: twoStepRoute({
    method: "POST",
    path: "/auth/two-step/recovery-codes",
    csrf: true,
    request: twoStepNewCodesRequestSchema,
    response: recoveryCodesResponseSchema,
  }),
  // Public: the challenge cookie is the credential. Like login it has no
  // CSRF cookie yet, so it takes only JSON from our own origin.
  verify: twoStepRoute({
    method: "POST",
    path: TWO_STEP_VERIFY_PATH,
    csrf: false,
    request: twoStepVerifyRequestSchema,
    response: twoStepVerifyResponseSchema,
  }),
} as const;
