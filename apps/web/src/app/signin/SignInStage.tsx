import { Pause, Play } from "lucide-react";
import { useEffect, useRef, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { BorderBeam } from "@/components/kit/BorderBeam";
import { ShineBorder } from "@/components/kit/ShineBorder";
import { StageMedia } from "./StageMedia";
import { setStagePaused, useStagePaused } from "./stagePause";
import { useReducedPreference } from "./useReducedPreference";

/** The most the frame leans toward the pointer, in degrees. */
const TILT = 4;

/**
 * The hero stage: a glass frame in 16:9 between the headline and the steps.
 * It leans a few degrees toward a mouse pointer (never a finger, never under
 * reduced motion) and hands the pointer to the scene so its layers shift by
 * depth. The Pause button holds every moving thing on the page (WCAG 2.2.2).
 * The picture is decoration; the group is named for a screen reader.
 */
export function SignInStage() {
  const { t } = useTranslation("signin");
  const paused = useStagePaused();
  const reduced = useReducedPreference();
  const frame = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });

  // Leaving the page must not leave the rest of the app held still.
  useEffect(
    () => () => {
      setStagePaused(false);
    },
    [],
  );

  const lean = (event: PointerEvent<HTMLDivElement>) => {
    const node = frame.current;
    if (!node || reduced || event.pointerType !== "mouse") return;
    const box = node.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 2 - 1;
    const y = ((event.clientY - box.top) / box.height) * 2 - 1;
    pointer.current = { x, y: -y };
    node.style.setProperty("--tilt-x", `${String(-y * TILT)}deg`);
    node.style.setProperty("--tilt-y", `${String(x * TILT)}deg`);
  };
  const level = () => {
    pointer.current = { x: 0, y: 0 };
    frame.current?.style.setProperty("--tilt-x", "0deg");
    frame.current?.style.setProperty("--tilt-y", "0deg");
  };

  const Icon = paused ? Play : Pause;
  return (
    <div
      className="signin-stage-slot signin-rise min-h-0 min-w-0 lg:min-h-48"
      style={{ "--d": "300ms" } as React.CSSProperties}
    >
      <div
        ref={frame}
        role="group"
        aria-label={t("stage.label")}
        className="signin-stage relative aspect-video w-full lg:w-[min(100cqw,calc(100cqh*16/9))]"
        onPointerMove={lean}
        onPointerLeave={level}
      >
        <div aria-hidden="true" className="signin-stage-glow" />
        <div className="signin-stage-frame relative size-full overflow-hidden">
          <StageMedia paused={paused} reduced={reduced} pointer={pointer} />
          <div aria-hidden="true" className="signin-stage-veil" />
          {paused ? null : <BorderBeam size={120} duration={9} />}
          <ShineBorder
            borderWidth={1}
            duration={16}
            shineColor={["var(--signin-stage-glow)", "var(--signin-stage-sky)"]}
          />
        </div>
        <button
          type="button"
          className="signin-stage-btn"
          aria-label={paused ? t("stage.play") : t("stage.pause")}
          title={paused ? t("stage.play") : t("stage.pause")}
          onClick={() => {
            setStagePaused(!paused);
          }}
        >
          <Icon aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
