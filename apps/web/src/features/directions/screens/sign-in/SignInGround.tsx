import { Aurora } from "../../kit/Aurora";

/**
 * The picture behind the sign-in page: the aurora. It is decoration, holds no
 * text, and stays still when the person asked for less motion.
 */
export function SignInGround() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <Aurora height={0.55} opacity={0.6} />
    </div>
  );
}
