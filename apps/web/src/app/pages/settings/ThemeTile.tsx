import { Check } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { ThemePreference } from "@/lib/theme";
import { ThemePreview } from "./ThemePreview";

/**
 * One theme as a tile: a picture and its name, as a radio. The chosen tile has
 * a ring and a check, so it is never marked by colour alone. Only the chosen
 * tile is a tab stop; the group moves the choice with the arrow keys.
 */
export function ThemeTile({
  theme,
  label,
  checked,
  onChoose,
  onKeyDown,
}: {
  theme: ThemePreference;
  label: string;
  checked: boolean;
  onChoose: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      tabIndex={checked ? 0 : -1}
      data-theme-choice={theme}
      onClick={onChoose}
      onKeyDown={onKeyDown}
      className="group relative flex min-w-0 flex-col gap-s2 rounded-(--radius-control) border border-border bg-card p-s2 text-left transition-colors duration-150 ease-out hover:border-(--border-strong) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-checked:border-primary aria-checked:ring-2 aria-checked:ring-primary motion-reduce:transition-none pointer-coarse:min-h-11"
    >
      <ThemePreview theme={theme} />
      <span className="fs-14 px-s1 pb-s1 font-medium">{label}</span>
      <span
        aria-hidden="true"
        className="absolute top-s3 right-s3 hidden size-5 place-items-center rounded-full bg-primary text-primary-foreground group-aria-checked:grid"
      >
        <Check className="size-3" />
      </span>
    </button>
  );
}
