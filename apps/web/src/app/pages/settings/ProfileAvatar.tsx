import type { Ref } from "react";
import { AvailabilityControl } from "@/components/kit/availability-picker/AvailabilityControl";
import { UserAvatar } from "@/components/parts/UserAvatar";
import type { UseAvailability } from "@/lib/useAvailability";

/**
 * The 80 px avatar of the profile card, with the glass ring that sets the
 * person's availability over its corner. The ring is a button of its own, laid
 * over the avatar, and the card's "Change availability" button opens the same
 * menu (the Radix trigger is also the menu's anchor, so there is only one).
 */
export function ProfileAvatar({
  name,
  pictureId,
  availability,
  open,
  onOpenChange,
  onCloseAutoFocus,
  rootRef,
}: {
  name: string;
  pictureId: string | undefined;
  availability: UseAvailability;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  rootRef: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={rootRef} className="relative size-20 shrink-0">
      <UserAvatar
        name={name}
        pictureId={pictureId}
        className="size-20"
        textClassName="fs-28"
      />
      {availability.status === "ready" ? (
        <AvailabilityControl
          {...availability.controlProps}
          skin="ring"
          side="bottom"
          align="start"
          open={open}
          onOpenChange={onOpenChange}
          onCloseAutoFocus={onCloseAutoFocus}
          className="absolute top-[18%] left-[82%] -translate-x-1/2 -translate-y-1/2"
        />
      ) : null}
    </div>
  );
}
