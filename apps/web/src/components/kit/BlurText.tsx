// Kit: React Bits / BlurText. Licence: MIT with the Commons Clause. Adapted to OrderPilot's tokens.
import { motion } from "motion/react";
import { Fragment, useRef } from "react";
import { cn } from "@/lib/utils";
import { useOnScreen, useStill } from "./env";

interface BlurTextProps {
  text: string;
  /** Seconds between one word and the next. */
  stagger?: number;
  animateBy?: "words" | "letters";
  /** Pixels of blur each piece starts with. */
  blur?: number;
  /** Seconds to wait before the first word. */
  delay?: number;
  /** From this word on (0-based) the words take `accentClassName`: a closing phrase set apart. */
  accentFrom?: number;
  accentClassName?: string;
  className?: string;
}

/**
 * A headline whose words arrive one by one out of a blur, once, when it first
 * scrolls into view. For the sign-in headline and an empty state, not for
 * anything a person reads while working. The whole text sits in the markup
 * for a screen reader; the pieces are decoration. Under reduced motion it is
 * the plain text.
 */
export function BlurText({
  text,
  stagger = 0.08,
  animateBy = "words",
  blur = 8,
  delay = 0,
  accentFrom = Infinity,
  accentClassName,
  className,
}: BlurTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const still = useStill();
  const seen = useOnScreen(ref, { once: true });
  const pieces = animateBy === "words" ? text.split(" ") : Array.from(text);
  const accent = (index: number) =>
    index >= accentFrom ? accentClassName : undefined;
  if (still) {
    return (
      <span ref={ref} className={className}>
        {accentFrom === Infinity
          ? text
          : // The spaces sit between the spans, as text of their own: a screen reader joins words by them.
            pieces.map((piece, index) => (
              <Fragment key={`${piece}-${String(index)}`}>
                <span className={accent(index)}>{piece}</span>
                {index < pieces.length - 1 ? " " : ""}
              </Fragment>
            ))}
      </span>
    );
  }
  return (
    <span ref={ref} className={cn("inline", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {pieces.map((piece, index) => (
          <motion.span
            key={`${piece}-${String(index)}`}
            className={cn("inline-block whitespace-pre", accent(index))}
            initial={{ opacity: 0, y: 12, filter: `blur(${String(blur)}px)` }}
            animate={
              seen
                ? { opacity: 1, y: 0, filter: "blur(0px)" }
                : { opacity: 0, y: 12, filter: `blur(${String(blur)}px)` }
            }
            transition={{
              delay: delay + index * stagger,
              duration: 0.45,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {piece}
            {animateBy === "words" && index < pieces.length - 1 ? " " : ""}
          </motion.span>
        ))}
      </span>
    </span>
  );
}
