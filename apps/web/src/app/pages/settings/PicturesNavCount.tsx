import { MenuCount } from "@/app/shell/MenuCount";
import { useListCount } from "@/lib/useListCount";
import { WAITING_COUNT_API } from "./useReviewActions";

/**
 * How many pictures wait for this reviewer, beside the "Profile pictures"
 * entry. The entry is listed only for a role that may review, so asking is
 * allowed. Zero, loading and a failed count draw nothing: the panel itself
 * explains an error. The review list never holds the reviewer's own pictures,
 * so the number is only what they can act on.
 */
export function PicturesNavCount() {
  const total = useListCount(WAITING_COUNT_API);
  const waiting = total.data ?? 0;
  return waiting > 0 ? <MenuCount waiting={waiting} /> : null;
}
