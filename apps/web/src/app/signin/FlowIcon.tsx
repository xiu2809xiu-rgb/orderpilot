/**
 * The three stage icons of the order flow, drawn for OrderPilot on a 24 px
 * grid: a document in scan corners, a decision diamond, a person with a tick.
 */
export type FlowStage = "read" | "decide" | "approve";

export function FlowIcon({ stage }: { stage: FlowStage }) {
  switch (stage) {
    case "read":
      return (
        <>
          <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
          <path d="M8 9h8M8 12.5h8M8 16h5" />
        </>
      );
    case "decide":
      return (
        <>
          <path d="M12 2.5 21.5 12 12 21.5 2.5 12z" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </>
      );
    case "approve":
      return (
        <>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" />
          <path d="m16.5 10.5 2 2 3.5-4" />
        </>
      );
  }
}
