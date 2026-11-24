import { Bone } from "./Bone";
import { CardBones } from "./CardBones";
import { TableBones } from "./TableBones";

/**
 * A record while it loads: the way back, its number and name, a strip of
 * facts, then the journey and the details it holds.
 */
export function RecordShape() {
  return (
    <div aria-hidden="true">
      <Bone className="mb-2 h-4 w-20" />
      <div className="mb-6 flex flex-col gap-2">
        <Bone className="h-8 w-44" />
        <Bone className="h-4 w-72 max-w-full" />
      </div>
      <div className="dx-card mb-8 grid grid-cols-2 gap-6 px-6 py-4 md:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Bone className="h-3 w-12" />
            <Bone className="h-5 w-20" />
          </div>
        ))}
      </div>
      <CardBones lines={3} className="mb-8" />
      <TableBones rows={4} />
    </div>
  );
}
