import { RecordLink } from "@/components/common";
import { hasPermission, useSessionStore } from "@/stores/session";

/** An SPR's number, as a link for the roles that may open one. */
export function SprNumber({ recordNo }: { recordNo: string | null }) {
  const session = useSessionStore((state) => state.session);
  if (!recordNo) return null;
  if (!hasPermission(session, "spr.read")) {
    return <span className="font-mono">{recordNo}</span>;
  }
  return (
    <RecordLink
      to={`/workflows/sprs/${recordNo}`}
      className="font-mono text-primary underline-offset-4 hover:underline"
    >
      {recordNo}
    </RecordLink>
  );
}
