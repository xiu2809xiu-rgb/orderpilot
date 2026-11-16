import { useStill } from "@/components/kit/env";
import { HomeFigure } from "./HomeFigure";

/**
 * The line under the greeting, with its figures counting up once. The words
 * are the translated sentence, split around its digits, so the figures are
 * always the ones the sentence says and no locale needs its own markup. A
 * screen reader gets the finished sentence in one piece; the counting copy is
 * hidden from it. Under reduced motion, and where motion cannot be known (the
 * test runner), the sentence is plain text.
 */
export function HomeIntroLine({ text }: { text: string }) {
  const still = useStill();
  if (still) return <>{text}</>;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(/(\d+)/).map((part, index) =>
          index % 2 === 1 ? (
            // An odd piece is a run of digits: the split keeps its separators.
            <HomeFigure key={index} value={Number(part)} />
          ) : (
            part
          ),
        )}
      </span>
    </>
  );
}
