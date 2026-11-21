import { Fragment, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDeferredModule } from "@/lib/deferred";
import { GLOSSARY_KEYS, type GlossaryKey } from "./glossary";
import type { TermLine } from "./TermTipBody";
import { tipModule, useTermTip } from "./useTermTip";

export { GLOSSARY_KEYS, type GlossaryKey };

/**
 * The lines of some words of the glossary. They are in the `components`
 * namespace, which loads with the page that shows a word; until then `ready`
 * is false and there are no lines.
 */
function useGlossaryLines(words: readonly GlossaryKey[]): {
  ready: boolean;
  lines: TermLine[];
} {
  const { t, ready } = useTranslation("components", { useSuspense: false });
  if (!ready) return { ready, lines: [] };
  return {
    ready,
    lines: words.map((word) => ({
      term: t(`glossary.${word}.term`),
      long: t(`glossary.${word}.long`, { defaultValue: "" }),
      meaning: t(`glossary.${word}.meaning`),
    })),
  };
}

/** What a screen reader hears: one word as its long form and meaning, several each led by its term. */
function describe(lines: readonly TermLine[]): string {
  return lines
    .map(({ term, long, meaning }) => {
      const said = long ? `${long}. ${meaning}` : meaning;
      return lines.length > 1 ? `${term}: ${said}` : said;
    })
    .join(" ");
}

/** The text of one or more glossary words, with their long forms in reach. */
function TermBox({
  words,
  children,
  focusable,
}: {
  words: readonly GlossaryKey[];
  children?: ReactNode;
  focusable: boolean;
}) {
  const { ready, lines } = useGlossaryLines(words);
  const ref = useRef<HTMLElement>(null);
  const tip = useTermTip(ref);
  const Tip = useDeferredModule(tipModule)?.default;
  return (
    <abbr
      ref={ref}
      // Focus is the only way a keyboard reaches the long form (WCAG 2.1.1, 1.4.13).
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={focusable ? 0 : undefined}
      aria-description={ready ? describe(lines) : undefined}
      className="relative cursor-help rounded-sm underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children ?? lines[0]?.term}
      {tip.armed && Tip && ready ? (
        <Tip
          lines={lines}
          open={tip.open}
          onOpenChange={(open) => {
            if (!open) tip.close();
          }}
          onPointerEnter={tip.enter}
          onPointerLeave={tip.leave}
        />
      ) : null}
    </abbr>
  );
}

/**
 * An abbreviation with its long form in reach: shown on hover and on keyboard
 * focus, and read out as the abbreviation's description at once, before any
 * tooltip code has arrived. The description is an attribute, not a `title`
 * (the pointer would see two tooltips) and not a hidden element (it would join
 * the text of the row that holds it). It is itself focusable, so never put it
 * inside a button or a link: there, or where a list would gain a tab stop per
 * row, pass `focusable={false}`, which keeps the description and the hover.
 */
export function Term({
  word,
  children,
  focusable = true,
}: {
  word: GlossaryKey;
  children?: ReactNode;
  focusable?: boolean;
}) {
  return (
    <TermBox words={[word]} focusable={focusable}>
      {children}
    </TermBox>
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

interface TermOptions {
  focusable?: boolean;
}

/**
 * Text with each glossary word in it drawn as a `Term`, for fixed sentences
 * that come from a locale file and cannot be split by the caller. The word is
 * drawn from the text itself, so it reads at once while the glossary loads.
 */
export function withTerms(
  text: string,
  { focusable }: TermOptions = {},
): ReactNode {
  const parts: ReactNode[] = [];
  let from = 0;
  for (const match of text.matchAll(WORDS)) {
    const word = WORD_OF[match[0]];
    if (word === undefined) continue;
    if (match.index > from) parts.push(text.slice(from, match.index));
    parts.push(
      <Term word={word} focusable={focusable}>
        {match[0]}
      </Term>,
    );
    from = match.index + match[0].length;
  }
  if (parts.length === 0) return text;
  if (from < text.length) parts.push(text.slice(from));
  return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>);
}

/**
 * A short label that has a glossary word in it, kept whole: one element holds
 * the label's own text, so the label reads, and is found by its words, as it
 * did before, and its tip explains every word in it. For a label that other
 * code finds by its full text, where `withTerms` would split it.
 */
export function withTermLabel(
  text: string,
  { focusable }: TermOptions = {},
): ReactNode {
  const words = new Set<GlossaryKey>();
  for (const match of text.matchAll(WORDS)) {
    const word = WORD_OF[match[0]];
    if (word !== undefined) words.add(word);
  }
  if (words.size === 0) return text;
  return (
    <TermBox words={[...words]} focusable={focusable ?? true}>
      {text}
    </TermBox>
  );
}
