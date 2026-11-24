import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/kit/Alert";
import { Section } from "@/components/parts/Section";
import {
  SettingFootnote,
  SettingList,
  SettingRow,
} from "@/components/parts/SettingRow";
import { useAvailability } from "@/lib/useAvailability";
import { useMyPicture } from "@/lib/useMyPicture";
import { useSessionStore } from "@/stores/session";
import { AvailabilityRow } from "./AvailabilityRow";
import { ProfileAvatar } from "./ProfileAvatar";

/** Who is signed in, and what the role is for. The name and email are not editable here. */
export function ProfileCard() {
  const { t } = useTranslation(["settings", "common"]);
  const session = useSessionStore((state) => state.session);
  const { picture } = useMyPicture();
  const availability = useAvailability();
  const [open, setOpen] = useState(false);
  const avatar = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // Which control opened the menu, so focus goes back to that one (WCAG 2.4.3).
  const openedByButton = useRef(false);
  if (!session) return null;

  // The 320 px card is tall: bring the ring to the middle of the screen first,
  // so the menu is never placed against an anchor that is off screen.
  function openFromButton() {
    avatar.current?.scrollIntoView({ block: "center" });
    openedByButton.current = true;
    setOpen(true);
  }
  const { user } = session;
  return (
    <Section title={t("account.profile")}>
      <div className="flex items-center gap-s3 pb-s4">
        <ProfileAvatar
          name={user.displayName}
          pictureId={picture?.approved?.id}
          availability={availability}
          open={open}
          rootRef={avatar}
          onOpenChange={(next) => {
            if (next) openedByButton.current = false;
            setOpen(next);
          }}
          onCloseAutoFocus={(event) => {
            if (!openedByButton.current) return;
            openedByButton.current = false;
            event.preventDefault();
            button.current?.focus();
          }}
        />
        <div className="min-w-0">
          <p className="fs-18 font-semibold break-words">{user.displayName}</p>
          <p className="fs-14 break-words text-muted-foreground">
            {user.email}
          </p>
        </div>
      </div>
      <SettingList className="border-t border-border pt-s3">
        <SettingRow
          label={t("account.role")}
          // A role that is removed later has no blurb: the row then shows only its name.
          description={t(`account.roleBlurb.${user.role}`, {
            defaultValue: "",
          })}
          value={t(`common:roles.${user.role}`)}
          align="start"
        />
        <AvailabilityRow
          availability={availability}
          open={open}
          onChange={openFromButton}
          buttonRef={button}
        />
      </SettingList>
      {session.demo ? (
        <Alert variant="info" className="mt-s4">
          <AlertTitle>{t("account.demoTitle")}</AlertTitle>
          <AlertDescription>{t("account.demoBody")}</AlertDescription>
        </Alert>
      ) : null}
      {user.role === "SYSTEM_ADMIN" ? null : (
        <SettingFootnote>{t("account.managedBy")}</SettingFootnote>
      )}
    </Section>
  );
}
