import { Button } from "@/components/ui/button";

interface ProofFormButtonsProps {
  busy: boolean;
  submitLabel: string;
  cancelLabel: string;
  onCancel: () => void;
  /** The switch between the authenticator code and a recovery code, when the form offers one. */
  toggleLabel?: string;
  onToggle?: () => void;
}

/** The switch, Cancel and the one primary button of a dialog form. All wait while a code is being checked. */
export function ProofFormButtons({
  busy,
  submitLabel,
  cancelLabel,
  onCancel,
  toggleLabel,
  onToggle,
}: ProofFormButtonsProps) {
  return (
    <>
      {toggleLabel ? (
        <Button
          type="button"
          variant="ghost"
          className="self-start"
          disabled={busy}
          onClick={onToggle}
        >
          {toggleLabel}
        </Button>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </>
  );
}
