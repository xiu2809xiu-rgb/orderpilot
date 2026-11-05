// Finding and focusing cells by the data attributes the rows carry. The grid
// keeps no refs per cell: with 200 lines that is 1,000 of them to keep right.

export interface Place {
  row: number;
  rowEl: HTMLElement;
  /** The column's kind, or null when the row itself has the focus. */
  cell: string | null;
}

/** Where in the grid an element is, or null when it is not in a line. */
export function locate(root: HTMLElement, target: EventTarget): Place | null {
  if (!(target instanceof HTMLElement)) return null;
  const rowEl = target.closest<HTMLElement>("[data-row]");
  if (!rowEl || !root.contains(rowEl)) return null;
  const row = Number(rowEl.dataset.row);
  if (Number.isNaN(row)) return null;
  const cellEl = target.closest<HTMLElement>("[data-cell]");
  return {
    row,
    rowEl,
    cell:
      cellEl && rowEl.contains(cellEl) ? (cellEl.dataset.cell ?? null) : null,
  };
}

const NON_TEXT_INPUTS = new Set([
  "button",
  "checkbox",
  "radio",
  "submit",
  "reset",
  "file",
  "image",
  "range",
  "color",
]);

/** True where typing means something: Delete, the arrows and Enter are the field's own. */
export function isTextEntry(element: HTMLElement): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLSelectElement) return true;
  if (element instanceof HTMLInputElement) {
    return !NON_TEXT_INPUTS.has(element.type);
  }
  return element.isContentEditable;
}

/** True when part of the line's text is selected, such as for copying. */
export function hasSelectionIn(element: HTMLElement): boolean {
  const selection = window.getSelection();
  return (
    selection !== null &&
    !selection.isCollapsed &&
    selection.anchorNode !== null &&
    element.contains(selection.anchorNode)
  );
}

export function rowElement(root: HTMLElement, row: number) {
  return root.querySelector<HTMLElement>(`[data-row="${String(row)}"]`);
}

/** The control inside a cell: its input, or its button. */
export function controlOf(root: HTMLElement, row: number, kind: string) {
  return rowElement(root, row)
    ?.querySelector<HTMLElement>(`[data-cell="${kind}"]`)
    ?.querySelector<HTMLElement>("input, textarea, button");
}

/** Focuses an element, selecting a text entry so that typing replaces it. */
export function focusAndSelect(element: HTMLElement): void {
  element.focus();
  if (
    element instanceof HTMLInputElement &&
    !NON_TEXT_INPUTS.has(element.type)
  ) {
    element.select();
  }
}

/**
 * Focuses one cell of a line. A null kind is the line itself. False when there
 * is nothing there to focus.
 */
export function focusPlace(
  root: HTMLElement,
  row: number,
  kind: string | null,
): boolean {
  const element =
    kind === null ? rowElement(root, row) : controlOf(root, row, kind);
  if (!element) return false;
  focusAndSelect(element);
  return true;
}
