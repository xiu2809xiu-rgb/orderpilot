import { Bone } from "./Bone";
import { CardBones } from "./CardBones";
import { PageHeadBones } from "./PageHeadBones";

/** Settings while it loads: the head, the list of sections, and two cards at their reading width. */
export function SettingsShape() {
  return (
    <div className="dx-sheet" aria-hidden="true">
      <PageHeadBones intro={false} date={false} />
      <div className="grid gap-s4 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-s6">
        <div className="flex gap-s2 md:flex-col">
          {Array.from({ length: 5 }, (_, index) => (
            <Bone key={index} className="h-9 w-28 rounded-full md:w-full" />
          ))}
        </div>
        <div className="flex max-w-[44rem] min-w-0 flex-col gap-s4">
          <CardBones lines={3} />
          <CardBones lines={2} />
        </div>
      </div>
    </div>
  );
}
