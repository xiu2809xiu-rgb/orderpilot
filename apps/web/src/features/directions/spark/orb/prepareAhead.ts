import { useEffect } from "react";
import { prefersReducedMotion } from "@/components/kit/env";
import { SPARK_BUTTON_ID } from "../sparkIds";
import { gpuApi } from "./webgpu";

/** How long to wait for an idle moment before preparing anyway. */
const IDLE_TIMEOUT_MS = 2000;

/** The entry bundle holds only this file: the GPU module and its shader are fetched when it is time. */
function prepareNow() {
  if (prefersReducedMotion() || document.hidden || !gpuApi()) return;
  void import("./orbGpu").then(({ prepareOrbGpu }) => prepareOrbGpu());
}

/** Calls `run` when the browser is idle, or after the timeout where it has no idle callback. */
function whenIdle(run: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    return () => {
      cancelIdleCallback(id);
    };
  }
  const id = window.setTimeout(run, IDLE_TIMEOUT_MS);
  return () => {
    window.clearTimeout(id);
  };
}

/**
 * Prepares the orb's GPU program ahead of the first open of Spark: after the
 * window's load event, then at an idle moment, and never in a hidden tab (it
 * waits until the tab shows), under reduced motion, or without WebGPU. Returns
 * the way to cancel it.
 */
export function scheduleOrbPreparation(): () => void {
  if (prefersReducedMotion() || !gpuApi()) return () => undefined;
  let stop: () => void = () => undefined;
  const afterLoad = () => {
    stop = whenIdle(() => {
      if (document.hidden) {
        document.addEventListener("visibilitychange", afterLoad, {
          once: true,
        });
        return;
      }
      prepareNow();
    });
  };
  const start = () => {
    if (document.hidden) {
      document.addEventListener("visibilitychange", start, { once: true });
      return;
    }
    afterLoad();
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
  return () => {
    stop();
    window.removeEventListener("load", start);
    document.removeEventListener("visibilitychange", start);
    document.removeEventListener("visibilitychange", afterLoad);
  };
}

/**
 * Where Spark is available, prepares the orb ahead (see above), and again as
 * soon as a hand or the keyboard goes to the Spark button, which is the
 * strongest sign that the panel is about to open. Nothing is prepared where
 * Spark is not available.
 */
export function usePrepareOrbAhead(available: boolean) {
  useEffect(() => {
    if (!available) return;
    const cancel = scheduleOrbPreparation();
    const onIntent = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.closest(`#${SPARK_BUTTON_ID}`)
      ) {
        prepareNow();
      }
    };
    // pointerenter and focus do not bubble, so their bubbling twins are heard
    // on the document: one listener, and no change to the top bar's markup.
    document.addEventListener("pointerover", onIntent);
    document.addEventListener("focusin", onIntent);
    return () => {
      cancel();
      document.removeEventListener("pointerover", onIntent);
      document.removeEventListener("focusin", onIntent);
    };
  }, [available]);
}
