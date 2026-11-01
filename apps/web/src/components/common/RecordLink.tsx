import type { MouseEvent } from "react";
import { Link, type LinkProps } from "react-router";
import { gestureOf, useOpenRecord } from "./useOpenRecord";

export interface RecordLinkProps extends Omit<
  LinkProps,
  "to" | "onAuxClick" | "onMouseDown"
> {
  /** The record page's address, such as `/order-tracker/SO-26-0001`. */
  to: string;
}

/**
 * The link to a record. A plain click opens it as the active tab, and
 * Ctrl+click, Command+click or a middle click opens it in a background tab
 * and stays on this page. React Router leaves modified clicks to the browser,
 * so without this a record would open in a browser tab instead.
 */
export function RecordLink({ to, onClick, ...props }: RecordLinkProps) {
  const openRecord = useOpenRecord();

  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented) return;
    if (openRecord(to, gestureOf(event))) event.preventDefault();
  }

  return (
    <Link
      to={to}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        open(event);
      }}
      onAuxClick={(event) => {
        if (event.button === 1) open(event);
      }}
      onMouseDown={(event) => {
        // A middle press starts the browser's autoscroll on Windows; the click is ours.
        if (event.button === 1) event.preventDefault();
      }}
    />
  );
}
