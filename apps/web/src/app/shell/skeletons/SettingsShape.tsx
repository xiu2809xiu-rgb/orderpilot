import { CardBones } from "./CardBones";
import { PageHeadBones } from "./PageHeadBones";

/** Settings while it loads: the head and the sections at their reading width. */
export function SettingsShape() {
  return (
    <div className="max-w-3xl" aria-hidden="true">
      <PageHeadBones />
      <div className="flex flex-col gap-4">
        <CardBones lines={2} />
        <CardBones lines={2} />
        <CardBones lines={3} />
      </div>
    </div>
  );
}
