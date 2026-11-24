import { pictureRoutes } from "@orderpilot/shared";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/instance";
import { useSessionStore } from "@/stores/session";

/** The key carries the person, so one person's picture is never drawn for the next. */
export const myPictureKey = (userId: string) =>
  ["profile-picture", "mine", userId] as const;

const REFRESH_WHILE_WAITING_MS = 30_000;

/**
 * The signed-in person's own pictures: the approved one, the one waiting for
 * review and the last decision against them. The route always answers, so a
 * person with no picture is not an error. Any failure here means "no picture":
 * the avatar shows initials and nothing is thrown. With `watch` a waiting
 * picture is asked about again every 30 seconds (only while the tab is shown),
 * so the card learns of the reviewer's decision.
 */
export function useMyPicture({ watch = false }: { watch?: boolean } = {}) {
  const userId = useSessionStore((state) => state.session?.user.id);
  const query = useQuery({
    queryKey: myPictureKey(userId ?? "nobody"),
    queryFn: ({ signal }) => apiClient.call({ ...pictureRoutes.mine, signal }),
    enabled: userId !== undefined,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: (current) =>
      watch && current.state.data?.data.pending
        ? REFRESH_WHILE_WAITING_MS
        : false,
  });
  return { picture: query.data?.data, query };
}
