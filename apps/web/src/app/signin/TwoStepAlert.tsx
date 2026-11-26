import { SignInFailure } from "./SignInFailure";
import type { TwoStepFailure } from "../two-step/twoStepFailure";

/** The failure of a second-step try, drawn at the field and tied to it by id. */
export function TwoStepAlert({
  failure,
  id,
}: {
  failure: TwoStepFailure;
  id: string;
}) {
  return (
    <div id={id}>
      <SignInFailure failure={failure} />
    </div>
  );
}
