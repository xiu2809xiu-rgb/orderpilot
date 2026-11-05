import { z } from "zod";

export const ACTION_REASON_MAX_LENGTH = 500;

/**
 * The reason a person gives when they void or disable a record. The messages
 * are the words the screen shows, so the form and the API say the same thing.
 */
export const actionReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Enter a reason")
    .max(
      ACTION_REASON_MAX_LENGTH,
      `Keep the reason to ${String(ACTION_REASON_MAX_LENGTH)} characters or fewer`,
    ),
});

export type ActionReason = z.infer<typeof actionReasonSchema>;
