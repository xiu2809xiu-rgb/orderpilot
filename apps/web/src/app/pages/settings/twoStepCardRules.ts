import type { TwoStepStatus } from "@orderpilot/shared";

/** Which of the card's dialogs is open. */
export type TwoStepDialog = "setup" | "disable" | "codes" | null;

/** With this few recovery codes left, the card says to make new ones. */
export const FEW_CODES = 2;

/** Whether the card has a warning to show under its first row. */
export function hasTwoStepNotes(status: TwoStepStatus): boolean {
  return (
    status.lastLockedAt !== null ||
    (status.state === "on" &&
      status.recoveryCodesLeft !== null &&
      status.recoveryCodesLeft <= FEW_CODES)
  );
}
