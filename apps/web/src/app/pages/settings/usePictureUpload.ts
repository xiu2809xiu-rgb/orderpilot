import { pictureRoutes } from "@orderpilot/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common/toast";
import { apiClient } from "@/lib/api/instance";
import {
  PictureChoiceError,
  preparePicture,
  type PictureChoiceCode,
  type PreparedPicture,
} from "@/lib/pictures/prepare-picture";
import { myPictureKey } from "@/lib/useMyPicture";
import { useSessionStore } from "@/stores/session";

export type UploadPhase = "idle" | "preparing" | "preview" | "sending";

export interface PictureUpload {
  phase: UploadPhase;
  prepared: PreparedPicture | null;
  /** Why the file could not be used, found in the browser. */
  choiceError: PictureChoiceCode | null;
  /** What the server said when it refused the picture. */
  refusal: unknown;
  choose: (file: File) => Promise<void>;
  send: () => Promise<void>;
  /** Drops the preview and any error. */
  reset: () => void;
}

/**
 * Choosing a file, preparing it in the browser, seeing it, and sending it.
 * Nothing leaves the machine before the person presses send, and a refusal
 * keeps the preview so they can choose another.
 */
export function usePictureUpload(): PictureUpload {
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const userId = useSessionStore((state) => state.session?.user.id);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [prepared, setPrepared] = useState<PreparedPicture | null>(null);
  const [choiceError, setChoiceError] = useState<PictureChoiceCode | null>(
    null,
  );
  const [refusal, setRefusal] = useState<unknown>(null);

  function reset() {
    setPhase("idle");
    setPrepared(null);
    setChoiceError(null);
    setRefusal(null);
  }

  async function choose(file: File) {
    setPhase("preparing");
    setChoiceError(null);
    setRefusal(null);
    try {
      setPrepared(await preparePicture(file));
      setPhase("preview");
    } catch (error) {
      setPrepared(null);
      setChoiceError(
        error instanceof PictureChoiceError ? error.code : "cannot_read",
      );
      setPhase("idle");
    }
  }

  async function send() {
    if (!prepared || phase === "sending") return;
    setPhase("sending");
    setRefusal(null);
    try {
      const answer = await apiClient.upload(
        pictureRoutes.upload,
        prepared.blob,
      );
      if (userId) queryClient.setQueryData(myPictureKey(userId), answer);
      toast.done(t("account.picture.sent"));
      reset();
    } catch (error) {
      // The preview stays, so the person can choose another or try again.
      setRefusal(error);
      setPhase("preview");
    }
  }

  return { phase, prepared, choiceError, refusal, choose, send, reset };
}
