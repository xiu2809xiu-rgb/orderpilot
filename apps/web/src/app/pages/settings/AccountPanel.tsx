import { AccessCard } from "./AccessCard";
import { PictureCard } from "./PictureCard";
import { ProfileCard } from "./ProfileCard";
import { SessionCard } from "./SessionCard";

/** Account: who you are, what your role lets you do, and signing out. */
export function AccountPanel() {
  return (
    <div className="flex flex-col gap-s4">
      <ProfileCard />
      <PictureCard />
      <AccessCard />
      <SessionCard />
    </div>
  );
}
