import { AccessCard } from "./AccessCard";
import { ProfileCard } from "./ProfileCard";
import { SessionCard } from "./SessionCard";
import { TwoStepCard } from "./TwoStepCard";

/** Account: who you are, what your role lets you do, and signing out. */
export function AccountPanel() {
  return (
    <div className="flex flex-col gap-s4">
      <ProfileCard />
      <AccessCard />
      <TwoStepCard />
      <SessionCard />
    </div>
  );
}
