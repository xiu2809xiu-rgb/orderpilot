import { useSessionStore } from "@/stores/session";
import { HomeBody } from "./HomeBody";

/**
 * Home for the signed-in person. A role switch made on Home stays on this
 * route, so the screen is keyed by the person: the next one gets a Home of
 * their own, with nothing the last one did (Done today is kept in the browser under their own id, and read by `useDoneToday`)
 * and with its first view, not a page that changed under them.
 */
export default function HomeScreen() {
  const person = useSessionStore((state) => state.session?.user.id);
  return <HomeBody key={person} />;
}
