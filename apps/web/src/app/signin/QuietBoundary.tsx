import { Component, type ReactNode } from "react";

/**
 * Wraps decoration. If it throws, or its chunk fails to load, the decoration
 * disappears and the rest of the page carries on. Nothing is shown or logged
 * as a crash: a missing animation is not worth an error page.
 */
export class QuietBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
