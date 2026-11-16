import { type QueryClient, useQueryClient } from "@tanstack/react-query";
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
import { roleFor, undoTour } from "./tourUndo";
import { useTourTarget } from "./useTourTarget";

const NOWHERE: TourTarget = { kind: "none" };
/** How long the tour waits for the app's own saves before it undoes them. */
const SETTLE_MS = 8000;

/**
 * Resolves once no action of the app is still being saved. An undo sent while
 * the action it undoes is in flight is refused ("already being recorded").
 */
async function settled(client: QueryClient): Promise<void> {
  const until = Date.now() + SETTLE_MS;
  while (client.isMutating() > 0 && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
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
 * tour moves on. What it did goes back as it leaves each team for the last time,
 * and the rest when it ends, at the end or at any point, so the next run starts
 * from the same data. Escape ends it too.
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
          // Leaving a team for the last time: its actions go back now, as that
          // team, so the end needs no sign-ins of its own (they are rate limited).
          const later = TOUR_STEPS.slice(index).some(
            (next) => next.role === role,
          );
          const own = useDemoTour
            .getState()
            .undo.filter((entry) => roleFor(entry) === role);
          if (role && !later && own.length > 0) {
            await settled(queryClient);
            const result = await undoTour(own, role, role);
            useDemoTour.getState().forget(own);
            if (result.failed > 0) {
              toast.failed(t("tour.undoFailed", { count: result.failed }));
            }
          }
          await demoLogin(current.role);
          // Leave the old role's page first, then reset (not clear) the data,
          // so the page that is open fetches again as the new role.
          await navigate(current.path ?? "/");
          await queryClient.resetQueries();
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
    await settled(queryClient);
    const result = await undoTour(undo, role, HOME_ROLE);
    await queryClient.resetQueries();
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
