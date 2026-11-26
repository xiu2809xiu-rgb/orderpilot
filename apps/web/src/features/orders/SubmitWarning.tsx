import { CircleAlert } from "lucide-react";

/** A fact the person should read before confirming, which does not stop a submit. */
export function SubmitWarning({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-s1">
      <CircleAlert
        className="mt-0.5 size-4 shrink-0 text-warning"
        aria-hidden="true"
      />
      {/* min-w-0 lets a flex child shrink, so a long unbroken part number wraps. */}
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}
