import { Bone } from "./Bone";
import { PageHeadBones } from "./PageHeadBones";
import { TableBones } from "./TableBones";

/** A list page while it loads: the head, a row of filters, and the table. */
export function ListShape() {
  return (
    <div aria-hidden="true">
      <PageHeadBones intro={false} />
      <div className="mb-3 flex flex-wrap gap-3">
        <Bone className="h-10 w-full rounded-full sm:w-72" />
        <Bone className="h-10 w-36 rounded-full" />
        <Bone className="hidden h-10 w-36 rounded-full sm:block" />
      </div>
      <TableBones />
    </div>
  );
}
