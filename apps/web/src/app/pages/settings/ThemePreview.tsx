import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/theme";

/** One theme drawn as a small app: a side strip, a header line and two cards. */
function Mini({ dark, className }: { dark: boolean; className?: string }) {
  return (
    <div
      className={cn(
        dark ? "pv-dark" : "pv-light",
        "flex size-full bg-(--pv-ground)",
        className,
      )}
    >
      <div className="flex w-1/4 flex-col gap-1 border-r border-(--pv-line) bg-(--pv-side) p-1.5">
        <span className="h-1 rounded-full bg-(--pv-accent)" />
        <span className="h-1 rounded-full bg-(--pv-line)" />
        <span className="h-1 rounded-full bg-(--pv-line)" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-1.5">
        <span className="h-1.5 w-1/2 rounded-full bg-(--pv-text)" />
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          <span className="rounded-sm border border-(--pv-line) bg-(--pv-card)" />
          <span className="rounded-sm border border-(--pv-line) bg-(--pv-card)" />
        </div>
      </div>
    </div>
  );
}

/**
 * A picture of what a theme looks like. It is drawn with the colours of its
 * own theme, not the page's, so the Light tile stays light on a dark page.
 * "System" is the two halves cut along a diagonal. It is decoration: the
 * tile's label names it.
 */
export function ThemePreview({ theme }: { theme: ThemePreference }) {
  return (
    <span
      aria-hidden="true"
      className="relative block h-16 overflow-hidden rounded-md border border-border"
    >
      {theme === "system" ? (
        <>
          <Mini dark={false} />
          <Mini
            dark
            className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]"
          />
        </>
      ) : (
        <Mini dark={theme === "dark"} />
      )}
    </span>
  );
}
