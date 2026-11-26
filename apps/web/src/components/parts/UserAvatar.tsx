import {
  profilePictureImagePath,
  type PersonAvailability,
} from "@orderpilot/shared";
import { AvailabilityDot } from "@/components/kit/availability-picker/AvailabilityDot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

// The name is always written beside an avatar, so the picture adds nothing a
// screen reader needs: an empty alt says so. It is a constant because the text
// check in i18n.test.ts reads any literal alt as text, even an empty one.
const DECORATIVE = "";

export type ImageStatus = "idle" | "loading" | "loaded" | "error";

interface UserAvatarProps {
  name: string;
  /** The id of an approved picture. Pass a pending one only where the viewer is its owner or a reviewer: the server answers 404 to anyone else. */
  pictureId?: string | null;
  className?: string;
  /** The size of the initials. */
  textClassName?: string;
  /** Tells the caller when the picture loaded or failed, so a card can say so in words. */
  onImageStatus?: (status: ImageStatus) => void;
  /**
   * Someone's availability, read-only, from a lookup (ADR 0070). `label` is the
   * words for assistive technology, such as "Availability: Do not disturb";
   * the caller supplies them, so the part holds none. Only Focusing and Do not
   * disturb are drawn: Available is the default, and a mark beside every name
   * would say that the person is ready, which OrderPilot cannot know.
   */
  availability?: { value: PersonAvailability; label: string } | null;
  /** Draw Available too. Only for the person's own avatar. */
  showAvailable?: boolean;
}

/**
 * A person's approved picture, or their initials while it loads, when it
 * fails, and when there is none. It is decoration: the name is beside it.
 */
export function UserAvatar({
  name,
  pictureId,
  className,
  textClassName,
  onImageStatus,
  availability,
  showAvailable = false,
}: UserAvatarProps) {
  const avatar = (
    <Avatar className={cn("shrink-0", className)} aria-hidden="true">
      {pictureId ? (
        <AvatarImage
          src={profilePictureImagePath(pictureId)}
          alt={DECORATIVE}
          onLoadingStatusChange={onImageStatus}
        />
      ) : null}
      <AvatarFallback
        className={cn(
          "bg-accent font-semibold text-accent-foreground",
          textClassName,
        )}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
  const shown =
    availability && (availability.value !== "AVAILABLE" || showAvailable)
      ? availability
      : null;
  if (!shown) return avatar;
  // The dot is outside Radix's Avatar, which clips to its circle, and the
  // words are outside its aria-hidden root, so a screen reader reads them.
  return (
    <span
      className="relative inline-flex shrink-0"
      data-availability={shown.value}
    >
      {avatar}
      <AvailabilityDot
        value={shown.value}
        className="absolute top-[10%] left-[90%] -translate-x-1/2 -translate-y-1/2"
        style={{
          inlineSize: "clamp(14px, 36%, 24px)",
          blockSize: "auto",
          aspectRatio: "1",
        }}
      />
      <span className="sr-only">{shown.label}</span>
    </span>
  );
}
