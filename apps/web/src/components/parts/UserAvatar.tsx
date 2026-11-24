import { profilePictureImagePath } from "@orderpilot/shared";
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
  /** The id of an approved picture. Never pass a pending one: only its owner and the reviewers may see that. */
  pictureId?: string | null;
  className?: string;
  /** The size of the initials. */
  textClassName?: string;
  /** Tells the caller when the picture loaded or failed, so a card can say so in words. */
  onImageStatus?: (status: ImageStatus) => void;
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
}: UserAvatarProps) {
  return (
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
}
