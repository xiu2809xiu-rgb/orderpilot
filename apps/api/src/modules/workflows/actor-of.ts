import type { AuthContext } from "../../auth/auth-context.js";
import type { OrderActor } from "./domain/order-state-machine.js";

/** The signed-in person as the state machine names who made a move. */
export function actorOf(auth: AuthContext): OrderActor {
  return {
    kind: "user",
    userId: auth.user.id,
    name: auth.user.displayName,
    role: auth.user.role,
  };
}
