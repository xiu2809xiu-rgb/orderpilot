import { useEffect, useRef, useState, type RefObject } from "react";
import { formKey } from "./formKey";
import type { OrderNotice } from "./OrderNotices";
import type { OrderForm } from "./orderFormValues";

type Duplicate = Extract<OrderNotice, { kind: "duplicate" }>;

/**
 * Whether the form still holds what the refused create sent. While a repeated PO
 * number from a create is on screen, the form is watched, and the first change
 * to what a person typed sets `moved` for that notice and no other. A change the
 * panel makes itself (keeping the stored dates) is not the person's edit:
 * `writing` is held while it makes it, and `follow` moves the key it compares
 * with, so the offer does not vanish as if the form had been edited.
 *
 * The subscription lives only while there is something to lose, and compares a
 * key of the typed fields, not the whole form, so a poll that writes the stock
 * beside a line never counts. The key is also compared once when the
 * subscription starts: a field edited while the create was still in flight
 * leaves no later event, so without that look the offer would stay on a body
 * that no longer matches the form.
 */
export function useRevisionWatch(
  form: OrderForm,
  duplicate: Duplicate | null,
): {
  moved: boolean;
  writing: RefObject<boolean>;
  follow: () => void;
} {
  const [movedFor, setMovedFor] = useState<Duplicate | null>(null);
  const writing = useRef(false);
  const baseline = useRef("");
  const moved = duplicate !== null && movedFor === duplicate;
  const watched = duplicate?.fromCreate === true && !moved;
  useEffect(() => {
    if (!duplicate || !watched) return;
    baseline.current = duplicate.formKey;
    if (formKey(form.getValues()) !== baseline.current) {
      // An edit made while the create was in flight: the notice arrived late.
      setMovedFor(duplicate);
      return;
    }
    const watching = form.watch(() => {
      if (writing.current) return;
      if (formKey(form.getValues()) !== baseline.current) {
        setMovedFor(duplicate);
      }
    });
    return () => {
      watching.unsubscribe();
    };
  }, [form, duplicate, watched]);
  return {
    moved,
    writing,
    follow: () => {
      baseline.current = formKey(form.getValues());
    },
  };
}
