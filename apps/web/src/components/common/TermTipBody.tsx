import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** One glossary word as it reads: the word, its long form if it has one, and its meaning. */
export interface TermLine {
  term: string;
  long: string;
  meaning: string;
}

/**
 * The tooltip of a `Term`. Loaded by `Term` the first time a person points at
 * or focuses a word, so the pages that show words carry none of the tooltip's
 * code until then. Its anchor is an empty box over the word, so the word
 * itself is never given to the tooltip and is not remounted when this arrives.
 * A label with several words says each one, led by the word.
 */
export default function TermTipBody({
  lines,
  open,
  onOpenChange,
  onPointerEnter,
  onPointerLeave,
}: {
  lines: readonly TermLine[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The pointer on the tip keeps it open, so its text can be read and selected. */
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const several = lines.length > 1;
  return (
    <Tooltip open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger asChild>
        <span
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none absolute inset-0"
        />
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="fs-14 flex max-w-72 flex-col gap-1.5"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        {lines.map(({ term, long, meaning }) => (
          <span key={term} className="block">
            {long || several ? (
              <span className="block font-medium">
                {several ? (long ? `${term}: ${long}` : term) : long}
              </span>
            ) : null}
            <span className="block">{meaning}</span>
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
