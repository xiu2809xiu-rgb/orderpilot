import { Bone } from "./Bone";

/** The head of a page: a title, the line of context, and an optional intro. */
export function PageHeadBones({
  intro = true,
  date = true,
}: {
  intro?: boolean;
  /** The line of context under the title; a page that shows no date leaves it out. */
  date?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col gap-2" aria-hidden="true">
      <Bone className="h-8 w-64 max-w-full" />
      {date ? <Bone className="h-4 w-44" /> : null}
      {intro ? <Bone className="mt-1 h-4 w-96 max-w-full" /> : null}
    </div>
  );
}
