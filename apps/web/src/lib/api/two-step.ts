import {
  twoStepRoutes,
  type TwoStepDisableRequest,
  type TwoStepStatus,
  type TwoStepVerifyRequest,
  type TwoStepVerifyResponse,
} from "@orderpilot/shared";
import { apiClient } from "./instance";

// By hand with apiClient.call, not generated hooks: every generated POST is a
// query with `enabled: false`, and the sign-in step needs the route in
// NO_REFRESH by its relative path (ADR 0068). These calls never touch the
// query cache, so a setup key or a recovery code is held by nothing but the
// component that asked for it.

export async function fetchTwoStepStatus(): Promise<TwoStepStatus> {
  return (await apiClient.call(twoStepRoutes.status)).data;
}

/** Checks the second step of a sign-in. It does not adopt the session: the caller does, once its green hold is over. */
export function verifyTwoStep(
  body: TwoStepVerifyRequest,
): Promise<TwoStepVerifyResponse> {
  return apiClient.call(twoStepRoutes.verify, body);
}

export async function startTwoStepSetup(password?: string) {
  return (await apiClient.call(twoStepRoutes.setup, { password })).data;
}

export async function enableTwoStep(code: string) {
  return (await apiClient.call(twoStepRoutes.enable, { code })).data;
}

export async function disableTwoStep(
  body: TwoStepDisableRequest,
): Promise<TwoStepStatus> {
  return (await apiClient.call(twoStepRoutes.disable, body)).data;
}

export async function makeNewRecoveryCodes(code: string) {
  return (await apiClient.call(twoStepRoutes.newCodes, { code })).data;
}
