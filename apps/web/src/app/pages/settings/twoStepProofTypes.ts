import type { TwoStepFailure } from "@/app/two-step/twoStepFailure";

export type Proof = { code: string } | { recoveryCode: string };

export interface TwoStepProofFormProps<T> {
  idPrefix: string;
  /** Sends the proof (and the password, for a password session). Rejects with the failure. */
  send: (proof: Proof, password: string | undefined) => Promise<T>;
  /** The green hold is over. */
  onDone: (answer: T) => void;
  /** The server says the setup lapsed: the dialog starts again. */
  onSetupEnded?: (failure: TwoStepFailure) => void;
  /** Asks for the password again first (a password session). */
  needsPassword?: boolean;
  /** Offers the recovery-code switch (turning off only). */
  allowRecovery?: boolean;
  submitLabel: string;
  cancelLabel: string;
  onCancel: () => void;
  /** Tells the dialog when it must not be closed. */
  onBusy?: (busy: boolean) => void;
}
