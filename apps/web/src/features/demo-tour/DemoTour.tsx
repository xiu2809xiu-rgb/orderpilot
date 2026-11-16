import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { toast } from "@/components/common/toast";
import { demoLogin } from "@/lib/api/auth";
import { useDemoTour, type TourUndo } from "@/stores/demoTour";
import { useSessionStore } from "@/stores/session";
import { TourCard } from "./TourCard";
import { TourOverlay } from "./TourOverlay";
import { TOUR_STEPS, type TourStep, type TourTarget } from "./tourSteps";
import { undoTour } from "./tourUndo";
import { useTourTarget } from "./useTourTarget";

const NOWHERE: TourTarget = { kind: "none" };
/** The tour starts and ends as the management approver, on Home. */
const HOME_ROLE = "APPROVER";

/** What a click on this step's target did, read before the app acts on it. */
function undoOf(
  step: TourStep,
  element: Element,
  pathname: string,
): TourUndo | null {
  const data = element instanceof HTMLElement ? element.dataset : {};
  if (step.undo === "task" && data.taskId) {
    return { kind: "task", role: step.role, taskId: data.taskId };
  }
  if (step.undo === "payment" && data.order) {
    return { kind: "payment", orderNo: data.order };
  }
  const recordNo = /^\/workflows\/sprs\/([^/]+)/.exec(pathname)?.[1];
  if (step.undo === "spr" && recordNo) {
    return { kind: "spr", recordNo: decodeURIComponent(recordNo) };
  }
  return null;
}

/**
 * The demo tour: walks the sales flow across the six teams on the sample data.
 * Each step signs in as its role, opens its page, and lights one button; the
 * person clicks it (or presses Next where there is nothing to click), and the
 * tour moves on. Ending it, at the end or at any point, undoes what it did, so
 * the next run starts from the same data. Escape ends it too.
 */
export default function DemoTour() {
  const { t } = useTranslation();
  const { step, undo, goTo, remember, stop } = useDemoTour();
  const index = step ?? 0;
  const current = TOUR_STEPS[index];
  const role = useSessionStore((state) => state.session?.user.role);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const target = useTourTarget(current?.target ?? NOWHERE);
  const [busy, setBusy] = useState(false);
  const entered = useRef<number | null>(null);

  // Entering a step: its role first, then its page.
  useEffect(() => {
    if (!current || entered.current === index) return;
    entered.current = index;
    void (async () => {
      try {
        if (role !== current.role) {
          await demoLogin(current.role);
          queryClient.clear();
          await navigate(current.path ?? "/");
        } else if (current.path && pathname !== current.path) {
          await navigate(current.path);
        }
      } catch {
        toast.failed(t("tour.switchFailed"));
      }
    })();
  }, [current, index, role, pathname, navigate, queryClient, t]);

  // A "click" step moves on when its target is clicked, after the app has acted.
  const element = target.element;
  useEffect(() => {
    if (current?.advance !== "click" || !element) return;
    if (element instanceof HTMLElement) element.focus({ preventScroll: true });
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node) || !element.contains(event.target)) {
        return;
      }
      const entry = undoOf(current, element, window.location.pathname);
      if (entry) remember(entry);
      window.setTimeout(() => {
        goTo(index + 1);
      }, 0);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, [current, element, index, goTo, remember]);

  async function end() {
    setBusy(true);
    const result = await undoTour(undo, HOME_ROLE);
    queryClient.clear();
    await navigate("/");
    stop();
    if (result.failed > 0) {
      toast.failed(t("tour.undoFailed", { count: result.failed }));
    } else {
      toast.done(t("tour.done"));
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) void end();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  });

  if (!current) return null;
  const last = index === TOUR_STEPS.length - 1;
  const nextReady =
    !current.ready || (element !== null && current.ready(element));
  return (
    <TourOverlay rect={target.rect}>
      <TourCard
        index={index}
        total={TOUR_STEPS.length}
        stepId={current.id}
        advance={current.advance}
        nextReady={nextReady}
        missing={target.missing}
        busy={busy}
        last={last}
        onNext={() => {
          if (last) void end();
          else goTo(index + 1);
        }}
        onEnd={() => {
          void end();
        }}
      />
    </TourOverlay>
  );
}
