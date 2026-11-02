import { useRef, type KeyboardEvent, type RefObject } from "react";
import {
  focusPlace,
  hasSelectionIn,
  isTextEntry,
  locate,
  type Place,
} from "./gridNav";
import type { ColumnKind } from "./types";

interface GridKeysOptions {
  rootRef: RefObject<HTMLDivElement | null>;
  editable: readonly ColumnKind[];
  rowCount: number;
  add: () => void;
  remove: (index: number, from: ColumnKind | null) => void;
  /** True when the item cell shows a chosen item and no half-typed text. */
  isSettled: (row: number, input: HTMLInputElement) => boolean;
  readOnly: boolean;
}

function asKind(cell: string | null): ColumnKind | null {
  // The cell attribute comes from our own column kinds.
  return cell as ColumnKind | null;
}

/**
 * The keys of the grid, on one handler for all lines. Typing always wins: a
 * text entry keeps Delete, the left and right arrows and its own text, and
 * only Ctrl+Delete and Alt with an up or down arrow reach into it.
 */
export function useGridKeys(options: GridKeysOptions) {
  const { rootRef, editable, rowCount, add, remove, isSettled, readOnly } =
    options;
  // Set when Enter was pressed on an item still being worked out: the pick
  // that follows moves the focus on. Anything else typed in between cancels it.
  const advance = useRef<number | null>(null);

  function move(place: Place, step: number) {
    const root = rootRef.current;
    const next = place.row + step;
    if (!root || next < 0 || next >= rowCount) return;
    focusPlace(root, next, place.cell);
  }

  function moveOn(place: Place) {
    const root = rootRef.current;
    if (!root) return;
    const at = editable.findIndex((kind) => kind === place.cell);
    const following = at >= 0 ? editable[at + 1] : undefined;
    if (following) focusPlace(root, place.row, following);
    else add();
  }

  function onKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
    const root = rootRef.current;
    if (readOnly || !root) return;
    const place = locate(root, event.target);
    if (!place) return;
    const vertical = event.key === "ArrowUp" || event.key === "ArrowDown";
    if (event.altKey && vertical) {
      // The lookup would open its list on this key, so it is taken first.
      event.preventDefault();
      event.stopPropagation();
      move(place, event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key !== "Enter") {
      advance.current = null;
      return;
    }
    const target = event.target;
    if (
      place.cell === "item" &&
      target instanceof HTMLInputElement &&
      !event.nativeEvent.isComposing
    ) {
      if (isSettled(place.row, target)) {
        event.preventDefault();
        event.stopPropagation();
        moveOn(place);
      } else {
        advance.current = place.row;
      }
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const root = rootRef.current;
    if (readOnly || !root) return;
    const place = locate(root, event.target);
    const target = event.target;
    if (!place || !(target instanceof HTMLElement)) return;
    const textual = isTextEntry(target);

    if (event.key === "Delete") {
      if (event.ctrlKey) {
        event.preventDefault();
        remove(place.row, asKind(place.cell));
      } else if (
        !textual &&
        !event.shiftKey &&
        !event.altKey &&
        !event.metaKey &&
        !hasSelectionIn(place.rowEl)
      ) {
        event.preventDefault();
        remove(place.row, asKind(place.cell));
      }
      return;
    }
    if (event.defaultPrevented) return;

    if (event.key === "Enter") {
      if (event.shiftKey || event.nativeEvent.isComposing) return;
      if (target === place.rowEl) {
        event.preventDefault();
        const first = editable[0];
        if (first) focusPlace(root, place.row, first);
      } else if (textual) {
        event.preventDefault();
        moveOn(place);
      }
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (target.getAttribute("role") === "combobox") return;
      event.preventDefault();
      move(place, event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Escape" && textual) {
      event.preventDefault();
      focusPlace(root, place.row, null);
    }
  }

  return { onKeyDown, onKeyDownCapture, advance };
}
