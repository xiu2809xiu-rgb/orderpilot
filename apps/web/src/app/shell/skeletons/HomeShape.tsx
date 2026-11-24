import { Bone } from "./Bone";
import { CardBones } from "./CardBones";
import { PageHeadBones } from "./PageHeadBones";

/**
 * Home while it loads: the greeting, a list beside a second column, then a
 * row of counts. The role is not known here without loading the page's code,
 * so this is the shape most roles have.
 */
export function HomeShape() {
  return (
    <div className="dx-sheet" aria-hidden="true">
      <PageHeadBones />
      <div className="mb-6 flex gap-3">
        <Bone className="h-10 w-32 rounded-full" />
        <Bone className="h-10 w-40 rounded-full" />
      </div>
      <div className="dx-grid-gap grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <CardBones lines={7} />
        <CardBones lines={7} />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Bone key={index} className="dx-card h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
