import { LineAvailability } from "./LineAvailability";
import { LineLastPrice } from "./LineLastPrice";
import type { OrderForm } from "./orderFormValues";

/** What the server knows about each line's item, written beside the lines. */
export function LineContext({
  form,
  priceMasked,
  paused,
  editable,
}: {
  form: OrderForm;
  priceMasked: boolean;
  paused: boolean;
  /** A read-only page shows no last-price note, so it does not ask. */
  editable: boolean;
}) {
  return (
    <>
      <LineAvailability form={form} paused={paused} />
      <LineLastPrice
        form={form}
        priceMasked={priceMasked}
        paused={paused || !editable}
      />
    </>
  );
}
