import { useSearchParams } from "react-router";
import { OrderPage } from "./OrderPage";
import { OrderPicker } from "./OrderPicker";

/**
 * The order screen. The order is the address's `order` number, which the
 * Orders list, the home screen and the side peek all put there. Without one
 * the screen opens the most overdue open order, so the preview's screen switch
 * lands on a real order instead of an empty page.
 */
export default function OrderScreen() {
  const [params] = useSearchParams();
  const orderNo = params.get("order");
  return orderNo ? (
    <OrderPage key={orderNo} orderNo={orderNo} />
  ) : (
    <OrderPicker />
  );
}
