import { Trash2 } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import type { MyPicture } from "@orderpilot/shared";
import { ErrorPanel } from "@/components/common";
import { Section } from "@/components/parts/Section";
import { SettingFootnote } from "@/components/parts/SettingRow";
import { UserAvatar, type ImageStatus } from "@/components/parts/UserAvatar";
import { Button } from "@/components/ui/button";
import { myPictureKey, useMyPicture } from "@/lib/useMyPicture";
import { hasPermission, useSessionStore } from "@/stores/session";
import { PictureCardLoading } from "./PictureCardLoading";
import { PictureChooser } from "./PictureChooser";
import { PictureStatus } from "./PictureStatus";
import { usePictureUpload } from "./usePictureUpload";

// Only needed when someone takes a picture back.
const RemovePictureDialog = lazy(() =>
  import("./RemovePictureDialog").then((m) => ({
    default: m.RemovePictureDialog,
  })),
);

/**
 * The signed-in person's profile picture: choose one, see what it will look
 * like, send it for review, and read where it stands. A reviewer approves
 * every picture before it replaces the initials, so until then only the owner
 * and the reviewers can see it.
 */
export function PictureCard() {
  const { t } = useTranslation("settings");
  const session = useSessionStore((state) => state.session);
  const { picture, query } = useMyPicture({ watch: true });
  const upload = usePictureUpload();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState(false);
  const [imageStatus, setImageStatus] = useState<ImageStatus>("idle");
  const chooseRef = useRef<HTMLButtonElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  if (!session) return null;
  const shown = picture ? (picture.pending ?? picture.approved) : null;

  return (
    <Section
      work
      title={t("account.picture.title")}
      intro={t("account.picture.intro")}
    >
      {picture ? (
        <div className="flex flex-col gap-s4">
          <div className="flex items-start gap-s4">
            <UserAvatar
              name={session.user.displayName}
              // The owner may see a picture that waits for review: this is
              // their own card, and the only place that draws a pending one.
              pictureId={shown?.id}
              className="size-16"
              textClassName="fs-18"
              onImageStatus={setImageStatus}
            />
            <PictureStatus
              picture={picture}
              canReview={hasPermission(session, "users.manage")}
              // The avatar reports nothing when it unmounts, so a failure
              // outlives the picture it was about unless it is read only while one is shown.
              imageFailed={shown !== null && imageStatus === "error"}
            />
          </div>
          <PictureChooser
            upload={upload}
            another={picture.pending !== null || picture.approved !== null}
            limitReached={picture.uploads.used >= picture.uploads.limit}
            limit={picture.uploads.limit}
            chooseRef={chooseRef}
            removeAction={removeButton(picture)}
          />
          {session.demo ? (
            <p className="fs-14 max-w-prose text-muted-foreground">
              {t("account.picture.demoNote")}
            </p>
          ) : null}
        </div>
      ) : query.isPending ? (
        <PictureCardLoading label={t("account.picture.loading")} />
      ) : (
        <ErrorPanel
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}
      <SettingFootnote>{t("account.picture.footnote")}</SettingFootnote>
      {picture && (picture.pending ?? picture.approved) ? (
        <Suspense fallback={null}>
          {removing ? (
            <RemovePictureDialog
              open={removing}
              onOpenChange={setRemoving}
              pictureId={(picture.pending ?? picture.approved)?.id ?? ""}
              waiting={picture.pending !== null}
              onRemoved={(answer) => {
                queryClient.setQueryData(myPictureKey(session.user.id), {
                  data: answer,
                });
              }}
              returnFocus={() =>
                removeRef.current?.isConnected
                  ? removeRef.current
                  : chooseRef.current
              }
            />
          ) : null}
        </Suspense>
      ) : null}
    </Section>
  );

  function removeButton(current: MyPicture) {
    if (!current.pending && !current.approved) return null;
    return (
      <Button
        ref={removeRef}
        type="button"
        variant="outline"
        disabled={upload.phase === "sending"}
        onClick={() => {
          setRemoving(true);
        }}
      >
        <Trash2 aria-hidden="true" />
        {t("account.picture.remove")}
      </Button>
    );
  }
}
