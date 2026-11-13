// Kit: Magic UI / animated-list. Licence: MIT. Adapted to OrderPilot's tokens.
import { motion } from "motion/react";
import { Children, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useOnScreen, useStill } from "./env";

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  /** Seconds between one row arriving and the next. */
  stagger?: number;
  /** The list's name for a screen reader. */
  label?: string;
}

/**
 * A list whose rows arrive one after another, once, on its first view, with a
 * spring. Magic UI's version loops a feed; ours does not: a list that someone
 * is working in never moves again. Under reduced motion every row is there at
 * once.
 */
export function AnimatedList({
  children,
  className,
  stagger = 0.09,
  label,
}: AnimatedListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useStill();
  const seen = useOnScreen(ref, { once: true, margin: "-20px" });
  const rows = Children.toArray(children);

  return (
    <div
      ref={ref}
      role="list"
      aria-label={label}
      className={cn("flex flex-col", className)}
    >
      {rows.map((row, index) =>
        still ? (
          <div key={index} role="listitem">
            {row}
          </div>
        ) : (
          <motion.div
            key={index}
            role="listitem"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={
              seen
                ? { opacity: 1, scale: 1, y: 0 }
                : { opacity: 0, scale: 0.96, y: 8 }
            }
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 40,
              delay: index * stagger,
            }}
          >
            {row}
          </motion.div>
        ),
      )}
    </div>
  );
}
