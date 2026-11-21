// The store moved to lib/done-today.ts so another area's form can add a
// finished task without reaching into Home. Home keeps importing it from here.
export {
  doneKey,
  forgetDone,
  readDone,
  recordDone,
  recordFinishedTask,
  type DoneItem,
  type FinishedTask,
} from "@/lib/done-today";
