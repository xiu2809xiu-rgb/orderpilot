import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

export interface SegmentedOption {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** A link when the choice is an address, a button when it is a setting. */
  to?: string;
}

interface SegmentedProps {
  label: string;
  value: string;
  options: readonly SegmentedOption[];
  onSelect?: (id: string) => void;
}

const item =
  "dx-chrome-item inline-flex items-center gap-1.5 rounded-[3px] px-2.5 fs-13 font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--pv-fg)]";

/** A small group of exclusive choices in the preview's own bar. */
export function Segmented({ label, value, options, onSelect }: SegmentedProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="dx-chrome-group inline-flex items-center gap-0.5 rounded-[5px] p-0.5"
    >
      {options.map((option) => {
        const selected = option.id === value;
        const content = (
          <>
            {option.icon ? (
              <option.icon className="size-3.5" aria-hidden="true" />
            ) : null}
            {option.label}
          </>
        );
        return option.to ? (
          <Link
            key={option.id}
            to={option.to}
            aria-current={selected ? "true" : undefined}
            data-selected={selected}
            className={cn(item)}
          >
            {content}
          </Link>
        ) : (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            data-selected={selected}
            className={cn(item)}
            onClick={() => {
              onSelect?.(option.id);
            }}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
