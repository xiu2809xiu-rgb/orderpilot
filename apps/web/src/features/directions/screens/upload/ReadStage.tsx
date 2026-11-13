import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { prefersReducedMotion } from "../../kit/env";
import { LatticeLoader } from "../../kit/LatticeLoader";
import { ThoughtLine } from "../../kit/ThoughtLine";
import { SparkOrb } from "../../spark/orb/SparkOrb";
import type { DemoDocument } from "./demoDocument";

/** Where each step of the reading shows, in milliseconds from the start. */
const STEP_AT = [500, 1300, 2100];
const DONE_AT = 2700;
const SETTLE_MS = 600;

/**
 * Spark reading the document: the orb is thinking, the thought line shows what
 * it did, one step at a time (the pages, the type of document, the fields),
 * and a lattice loader says it is working. When the steps are told the line
 * settles with how long it took, and the review opens. Under reduced motion the
 * wait is short and the steps are all there at once.
 */
export function ReadStage({
  document: doc,
  onDone,
}: {
  document: DemoDocument;
  onDone: () => void;
}) {
  const { t } = useTranslation("directions-intake");
  const [reduced] = useState(prefersReducedMotion);
  const [shown, setShown] = useState(reduced ? STEP_AT.length : 0);
  const [finished, setFinished] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    const started = performance.now();
    const timers: number[] = [];
    if (reduced) {
      timers.push(
        window.setTimeout(() => {
          setSeconds((performance.now() - started) / 1000);
          setFinished(true);
          timers.push(window.setTimeout(onDone, 250));
        }, 300),
      );
    } else {
      STEP_AT.forEach((at, index) => {
        timers.push(
          window.setTimeout(() => {
            setShown(index + 1);
          }, at),
        );
      });
      timers.push(
        window.setTimeout(() => {
          setSeconds((performance.now() - started) / 1000);
          setFinished(true);
          timers.push(window.setTimeout(onDone, SETTLE_MS));
        }, DONE_AT),
      );
    }
    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, [reduced, onDone]);

  const all = [
    t("reading.steps.page"),
    t("reading.steps.classify"),
    t("reading.steps.fields", { count: doc.fields.length }),
  ];
  const timer =
    seconds === null
      ? undefined
      : t("reading.seconds", { value: seconds.toFixed(1) });
  return (
    <div
      className="dx-card flex flex-col items-center gap-5 px-6 py-10 text-center"
      aria-busy={!finished}
    >
      <SparkOrb
        state={finished ? "idle" : "thinking"}
        label={t(finished ? "reading.done" : "reading.label")}
        className="size-28"
      />
      <h2 className="fs-20 font-semibold text-foreground">
        {t("reading.title")}
      </h2>
      <div className="flex flex-col items-start gap-4 text-left">
        <ThoughtLine
          working={!finished}
          label={t("reading.label")}
          doneLabel={t("reading.done")}
          steps={all.slice(0, shown)}
          timer={timer}
          toggleLabel={t("reading.toggle")}
        />
        <LatticeLoader
          label={t("reading.mock")}
          status={finished ? "done" : "working"}
        />
      </div>
    </div>
  );
}
