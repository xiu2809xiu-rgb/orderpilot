import { LineAvailability } from "./LineAvailability";
import { LineLastPrice } from "./LineLastPrice";
import type { OrderForm } from "./orderFormValues";

/** What the server knows about each line's item, written beside the lines. */
export function LineContext({
  form,
  priceMasked,
  paused,
}: {
  form: OrderForm;
  priceMasked: boolean;
  paused: boolean;
}) {
  return (
    <>
      <LineAvailability form={form} paused={paused} />
      <LineLastPrice form={form} priceMasked={priceMasked} paused={paused} />
    </>
  );
}
