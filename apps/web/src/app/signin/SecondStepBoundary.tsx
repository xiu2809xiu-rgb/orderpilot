import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SignInFailure } from "./SignInFailure";

interface SecondStepBoundaryProps {
  /** Said when the second step could not be loaded or drawn. */
  message: string;
  backLabel: string;
  /** Back to the password form. */
  onBack: () => void;
  children: ReactNode;
}

/**
 * Around the second step's lazy chunk. A stale deploy or a dropped connection
 * makes the import fail, and without this the whole page falls to the crash
 * screen while the challenge cookie is still alive. The failure is told in
 * plain words, with the way back to the password form.
 */
export class SecondStepBoundary extends Component<
  SecondStepBoundaryProps,
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex flex-col gap-3">
        <SignInFailure
          failure={{ message: this.props.message, traceId: undefined }}
        />
        <Button
          type="button"
          variant="ghost"
          className="w-full pointer-coarse:h-11"
          onClick={this.props.onBack}
        >
          {this.props.backLabel}
        </Button>
      </div>
    );
  }
}
