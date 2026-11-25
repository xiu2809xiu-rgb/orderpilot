// Kit: "Avatar Status Picker" idea by Nitish Khagwal (https://x.com/nitishkmrk/status/2121129936497111406/video/1),
// seen on LeiBox (https://leibox.pantoria.cn, github.com/leishifu666/LeiBox) on 24 Nov 2026. LeiBox states that no
// separate licence was supplied or verified for the original and marks it as not redistributable. This is OrderPilot's
// own build from a written description of the behaviour (proportions, spring feel, a caption that follows the choice,
// a flash of light after a pick, the keyboard model): no source, markup, picture, font, colour or glyph drawing was
// copied. A private prototype for a school module. Adapted to OrderPilot's tokens.
import {
  useEffect,
  useEffectEvent,
  useId,
  useState,
  type PointerEvent,
  type SyntheticEvent,
} from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  dropdownMenuModule,
} from "@/app/shell/overlays/dropdown-menu";
import { deferredPart } from "@/app/shell/overlays/deferred";
import {
  deferredModule,
  prefetch,
  useDeferredModule,
  whenIdle,
} from "@/lib/deferred";
import { AvailabilityTrigger } from "./AvailabilityTrigger";
import { forgetOpeningPress, recordOpeningPress } from "./openingPress";
import type { AvailabilityPickerProps } from "./types";

// The pill, its orbs and its caption load after the first paint, on idle, and
// sooner on hover or focus. Until then the trigger is the shell's stand-in.
export const pickerModule = deferredModule(
  () => import("./AvailabilityPicker"),
);
const PickerContent = deferredPart(pickerModule, (ui) => ui.AvailabilityPicker);

const OPENING_KEYS = ["Enter", " ", "ArrowDown", "ArrowUp"];

/**
 * The availability control, thin on purpose: it sits in the first screen. The
 * menu is the shell's own deferred dropdown, so the stand-in, the prefetch and
 * the hand-over of focus are not written again here.
 */
export function AvailabilityControl({
  value,
  onChange,
  labels,
  skin = "dot",
  side = "top",
  align = "start",
  open,
  defaultOpen,
  onOpenChange,
  busy = false,
  pulse = 0,
  onCloseAutoFocus,
  className,
}: AvailabilityPickerProps) {
  const descriptionId = useId();
  // The pill may arrive late, or never (a slow or failed chunk): the trigger
  // fades its face only while the pill is in the page to cover it.
  const [pillOpen, setPillOpen] = useState(false);
  const menuReady = useDeferredModule(dropdownMenuModule) !== undefined;

  // The control keeps the open state itself when no parent does, so it can
  // close a menu whose pill never came.
  const [ownOpen, setOwnOpen] = useState(defaultOpen ?? false);
  const isOpen = open ?? ownOpen;
  const change = (next: boolean) => {
    if (open === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };
  const giveUp = useEffectEvent(() => {
    change(false);
  });
  // Asking again also retries a chunk that failed: the module forgets a failure.
  // Nothing is said, as with the shell's other deferred menus: a failed chunk
  // closes the menu and the next press tries again.
  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    pickerModule.load().catch(() => {
      if (live) giveUp();
    });
    return () => {
      live = false;
    };
  }, [isOpen]);

  useEffect(
    () =>
      whenIdle(() => {
        prefetch(pickerModule);
      }),
    [],
  );
  // The opening press is kept in a module, so it must go when the control does:
  // a later control on the same page, or a test's next render, would otherwise
  // see a press that its own trigger never took.
  useEffect(() => forgetOpeningPress, []);

  // While a save is in flight a press does nothing. A handler that stops the
  // default also stops Radix and the stand-in from opening the menu.
  const hold = (event: SyntheticEvent) => {
    if (busy) event.preventDefault();
  };
  // The press that opens the menu is kept, for the pill's choices to tell a
  // slow second click from a pick (openingPress.ts). A press that Radix will
  // not turn into an opening (a save in flight, a press while the menu is
  // open, another button, the control key) is not an opening press.
  const press = (event: PointerEvent<HTMLElement>) => {
    hold(event);
    if (busy || isOpen || event.button !== 0 || event.ctrlKey) return;
    recordOpeningPress(event);
  };
  const holdKey = (event: SyntheticEvent & { key?: string }) => {
    if (busy && event.key && OPENING_KEYS.includes(event.key)) {
      event.preventDefault();
    }
  };
  // On hover and focus the spring library is fetched too, so the first
  // opening does not stall on loading it.
  const warm = () => {
    prefetch(pickerModule);
    void import("./useChipSpring").then((spring) => spring.loadSpring());
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={change}>
        <DropdownMenuTrigger
          asChild
          onPointerDown={press}
          onClick={hold}
          onKeyDown={holdKey}
          onPointerEnter={warm}
          onFocus={warm}
        >
          <AvailabilityTrigger
            value={value}
            label={labels.trigger}
            skin={skin}
            busy={busy}
            pulse={pulse}
            pillOpen={pillOpen}
            className={className}
          />
        </DropdownMenuTrigger>
        {menuReady ? (
          <PickerContent
            value={value}
            onChange={onChange}
            labels={labels}
            skin={skin}
            side={side}
            align={align}
            descriptionId={descriptionId}
            onPresent={setPillOpen}
            onCloseAutoFocus={onCloseAutoFocus}
          />
        ) : null}
      </DropdownMenu>
      {/* Read by the menu, never in browse mode: it holds the 12 hours and the reminders. */}
      <span id={descriptionId} hidden>
        {labels.description}
      </span>
      {/* One permanent node: a live region that appears with its text is often not announced. */}
      <span role="status" className="sr-only">
        {busy ? labels.saving : ""}
      </span>
    </>
  );
}
