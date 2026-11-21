import { Bone } from "./Bone";
import { CardBones } from "./CardBones";
import { PageHeadBones } from "./PageHeadBones";

function Field() {
  return (
    <div className="flex flex-col gap-2">
      <Bone className="h-3.5 w-24" />
      <Bone className="h-10 w-full" />
    </div>
  );
}

/** A form while it loads: the head, a card of fields and a card of lines. */
export function FormShape() {
  return (
    <div className="dx-sheet" aria-hidden="true">
      <PageHeadBones />
      <div className="dx-card dx-card-work mb-6 flex flex-col gap-5 p-5">
        <Bone className="h-5 w-40" />
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Field key={index} />
          ))}
        </div>
      </div>
      <CardBones lines={3} />
    </div>
  );
}
