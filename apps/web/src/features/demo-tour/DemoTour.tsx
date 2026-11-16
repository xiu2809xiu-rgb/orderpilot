import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { toast } from "@/components/common/toast";
import { useDemoTour, type TourUndo } from "@/stores/demoTour";
import { useSessionStore } from "@/stores/session";
import { TourCard } from "./TourCard";
import { TourOverlay } from "./TourOverlay";
import { TOUR_STEPS, type TourStep, type TourTarget } from "./tourSteps";
import { roleFor, undoTour } from "./tourUndo";
import { useTourTarget } from "./useTourTarget";

const NOWHERE: TourTarget = { kind: "none" };
/** The top bar's Demo role button (`RoleSwitcher`), lit when the presenter must switch. */
const ROLE_BUTTON: TourTarget = { kind: "selector", selector: ".dx-bar-role" };
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
 * Nothing dims, so the teacher sees each page whole. Before another team's
 * step the tour lights Demo role and asks the presenter to switch, then opens
 * the step's page and lights one button; the presenter clicks it (or presses
 * Next where there is nothing to click), and the tour moves on. What it did goes back as it leaves each team for the last time,
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
  const [busy, setBusy] = useState(false);
  const [puttingBack, setPuttingBack] = useState(false);
  const prepared = useRef<number | null>(null);
  const arrived = useRef<number | null>(null);
  const lastRole = useRef(role);
  const switching = current !== undefined && role !== current.role;
  const target = useTourTarget(
    switching
      ? puttingBack
        ? NOWHERE
        : ROLE_BUTTON
      : (current?.target ?? NOWHERE),
  );

  // Before another team's step: the team the tour leaves for good gets its
  // actions put back now, while it is still signed in (sign-ins are rate
  // limited), and then the presenter is asked to switch.
  useEffect(() => {
    if (!current || prepared.current === index) return;
    prepared.current = index;
    if (!role || role === current.role) return;
    const later = TOUR_STEPS.slice(index).some((next) => next.role === role);
    const own = useDemoTour
      .getState()
      .undo.filter((entry) => roleFor(entry) === role);
    if (later || own.length === 0) return;
    setPuttingBack(true);
    void (async () => {
      await settled(queryClient);
      const result = await undoTour(own, role, role);
      useDemoTour.getState().forget(own);
      if (result.failed > 0) {
        toast.failed(t("tour.undoFailed", { count: result.failed }));
      }
      setPuttingBack(false);
    })();
  }, [current, index, role, queryClient, t]);

  // Once the step's role is signed in: after a switch, the open page fetches
  // again as the new role (a reset, not a clear), and the step's page opens.
  useEffect(() => {
    if (!current || role !== current.role || arrived.current === index) return;
    arrived.current = index;
    const switched = lastRole.current !== role;
    lastRole.current = role;
    void (async () => {
      if (switched) await queryClient.resetQueries();
      if (current.path && pathname !== current.path) {
        await navigate(current.path);
      }
    })();
  }, [current, index, role, pathname, navigate, queryClient]);

  // A "click" step moves on when its target is clicked, after the app has acted.
  const element = target.element;
  useEffect(() => {
    if (switching || current?.advance !== "click" || !element) return;
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
  }, [current, element, index, switching, goTo, remember]);

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
        switchTo={switching ? t(`roles.${current.role}`) : null}
        puttingBack={puttingBack}
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
