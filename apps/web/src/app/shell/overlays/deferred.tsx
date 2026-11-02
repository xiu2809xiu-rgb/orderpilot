import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefObject,
  type SyntheticEvent,
} from "react";
import {
  prefetch,
  useDeferredModule,
  whenIdle,
  type DeferredModule,
} from "@/lib/deferred";

// The shell's menus, popover and sheet are Radix components that weigh about
// 30 KB gzipped, yet they open only on a click. Until their chunk arrives
// (on idle, on hover or on focus) the trigger is a plain button that looks the
// same; a click on it opens the real one as soon as it has loaded.

interface RootState {
  /** True while the stand-in has focus, so the real trigger can take it. */
  focused: RefObject<boolean>;
  prefetch(): void;
  requestOpen(): void;
}

const RootContext = createContext<RootState | null>(null);

export interface OpenProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

interface DeferredRootProps<M> extends OpenProps {
  module: DeferredModule<M>;
  render: (loaded: M, props: OpenProps) => ReactNode;
}

export function DeferredRoot<M>({
  module,
  render,
  open,
  defaultOpen,
  onOpenChange,
  children,
}: DeferredRootProps<M>) {
  const loaded = useDeferredModule(module);
  const [opening, setOpening] = useState(false);
  const focused = useRef(false);

  useEffect(
    () =>
      whenIdle(() => {
        prefetch(module);
      }),
    [module],
  );

  const state = useMemo<RootState>(
    () => ({
      focused,
      prefetch: () => {
        prefetch(module);
      },
      requestOpen: () => {
        // Controlled roots open through their owner; the others on arrival.
        if (open === undefined) setOpening(true);
        onOpenChange?.(true);
        prefetch(module);
      },
    }),
    [module, open, onOpenChange],
  );

  return (
    <RootContext value={state}>
      {loaded
        ? render(loaded, {
            open,
            defaultOpen: (defaultOpen ?? false) || opening,
            onOpenChange,
            children,
          })
        : children}
    </RootContext>
  );
}

export type TriggerProps = ComponentPropsWithRef<"button"> & {
  asChild?: boolean;
};

interface DeferredTriggerProps<M> extends TriggerProps {
  module: DeferredModule<M>;
  /** What the trigger opens, for `aria-haspopup`, as Radix sets it. */
  popup: "menu" | "dialog";
  slot: string;
  render: (loaded: M, props: TriggerProps) => ReactNode;
}

function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}

export function DeferredTrigger<M>({
  module,
  popup,
  slot,
  render,
  ref,
  ...props
}: DeferredTriggerProps<M>) {
  const loaded = useDeferredModule(module);
  const root = useContext(RootContext);
  if (!root) throw new Error("A deferred trigger must sit inside its root.");

  // The real trigger is a new element: give it the focus the stand-in had.
  const takeFocus = useCallback(
    (node: HTMLButtonElement | null) => {
      assignRef(ref, node);
      if (node && root.focused.current) {
        root.focused.current = false;
        node.focus();
      }
    },
    [ref, root],
  );

  if (loaded) return render(loaded, { ...props, ref: takeFocus });
  return <StandIn root={root} popup={popup} slot={slot} {...props} ref={ref} />;
}

type Handler = (event: SyntheticEvent) => void;
type HandlerName =
  "onClick" | "onFocus" | "onBlur" | "onPointerEnter" | "onKeyDown";

function StandIn({
  root,
  popup,
  slot,
  asChild,
  children,
  ...props
}: TriggerProps & { root: RootState; popup: "menu" | "dialog"; slot: string }) {
  const ours: Record<HandlerName, Handler> = {
    onClick: () => {
      root.requestOpen();
    },
    onFocus: () => {
      root.focused.current = true;
      root.prefetch();
    },
    onBlur: () => {
      root.focused.current = false;
    },
    onPointerEnter: () => {
      root.prefetch();
    },
    onKeyDown: (event) => {
      // Radix menus also open on the down arrow.
      if (popup === "menu" && "key" in event && event.key === "ArrowDown") {
        event.preventDefault();
        root.requestOpen();
      }
    },
  };
  const child =
    asChild && isValidElement(children)
      ? (children as ReactElement<Record<string, unknown>>)
      : null;
  const theirs: Record<string, unknown> = { ...props, ...(child?.props ?? {}) };
  const merged: Record<string, unknown> = {
    type: "button",
    "aria-haspopup": popup,
    "aria-expanded": false,
    "data-state": "closed",
    "data-slot": slot,
    ...theirs,
  };
  for (const name of Object.keys(ours) as HandlerName[]) {
    const own = props[name] as Handler | undefined;
    const childOwn = child?.props[name] as Handler | undefined;
    merged[name] = (event: SyntheticEvent) => {
      childOwn?.(event);
      own?.(event);
      if (!event.defaultPrevented) ours[name](event);
    };
  }
  if (child) return cloneElement(child, merged);
  return <button {...merged}>{children}</button>;
}

/** A part that renders only inside an open popup, so only once loaded. */
export function deferredPart<M, P extends object>(
  module: DeferredModule<M>,
  pick: (loaded: M) => ComponentType<P>,
) {
  function DeferredPart(props: P) {
    const loaded = useDeferredModule(module);
    if (!loaded) return null;
    const Real = pick(loaded);
    return <Real {...props} />;
  }
  return DeferredPart;
}
