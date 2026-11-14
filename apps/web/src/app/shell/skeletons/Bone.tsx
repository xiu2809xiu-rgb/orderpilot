import { cn } from "@/lib/utils";

/**
 * One block of a skeleton, as tall as the text or control it stands for so
 * that nothing moves when the page arrives. It does not pulse: a work screen
 * stays still while it waits, and the thin line above the page says it is busy.
 */
export function Bone({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("dx-bone", className)} />;
}
