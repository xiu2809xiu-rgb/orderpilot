import { Fragment, useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The words of the glossary in `common.json` (`glossary.<key>`), in the order
 * Help lists them. Help and every page read the same lines.
 */
export const GLOSSARY_KEYS = [
  "spr",
  "po",
  "pi",
  "packingList",
  "awb",
  "bl",
  "heldAt",
  "shortOnStock",
  "businessCentral",
] as const;

export type GlossaryKey = (typeof GLOSSARY_KEYS)[number];

/** The long form and the meaning of one word, as one sentence. */
export function useGlossaryLine(word: GlossaryKey): {
  term: string;
  long: string;
  meaning: string;
} {
  const { t } = useTranslation("common");
  return {
    term: t(`glossary.${word}.term`),
    long: t(`glossary.${word}.long`, { defaultValue: "" }),
    meaning: t(`glossary.${word}.meaning`),
  };
}

/**
 * An abbreviation with its long form in reach: shown on hover and on keyboard
 * focus, and read out as the abbreviation's description. The description sits
 * in a hidden element rather than a `title`, so the pointer sees one tooltip,
 * not two. Never put it inside a button or a link: it is itself focusable.
 */
export function Term({
  word,
  children,
}: {
  word: GlossaryKey;
  children?: ReactNode;
}) {
  const { term, long, meaning } = useGlossaryLine(word);
  const descriptionId = useId();
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <abbr
            // Focus is the only way a keyboard reaches the long form (WCAG 2.1.1, 1.4.13).
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            aria-describedby={descriptionId}
            className="cursor-help rounded-sm underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {children ?? term}
          </abbr>
        </TooltipTrigger>
        <TooltipContent side="top" className="fs-14 max-w-72">
          {long ? <span className="block font-medium">{long}</span> : null}
          <span className="block">{meaning}</span>
        </TooltipContent>
      </Tooltip>
      <span id={descriptionId} hidden>
        {long ? `${long}. ${meaning}` : meaning}
      </span>
    </>
  );
}

const WORD_OF: Readonly<Record<string, GlossaryKey>> = {
  SPR: "spr",
  PO: "po",
  PI: "pi",
  AWB: "awb",
  BL: "bl",
  "Held at": "heldAt",
  "Short on stock": "shortOnStock",
};

// A record number such as SPR-2026... is a number, not the word, so a hyphen
// on either side keeps the match out.
const WORDS =
  /(?<!-)\b(?:SPR|PO|PI|AWB|BL)\b(?![-\d])|\b(?:Held at|Short on stock)\b/g;

/**
 * Text with each glossary word in it drawn as a `Term`, for fixed sentences
 * that come from a locale file and cannot be split by the caller.
 */
export function withTerms(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let from = 0;
  for (const match of text.matchAll(WORDS)) {
    const word = WORD_OF[match[0]];
    if (word === undefined) continue;
    if (match.index > from) parts.push(text.slice(from, match.index));
    parts.push(<Term word={word} />);
    from = match.index + match[0].length;
  }
  if (parts.length === 0) return text;
  if (from < text.length) parts.push(text.slice(from));
  return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>);
}
