import { useDirection } from "../../frame/useDirection";
import { Aurora } from "../../kit/Aurora";
import { Dither } from "../../kit/Dither";
import { DotPattern } from "../../kit/DotPattern";

/**
 * The picture behind the sign-in page, one per direction: a dithered field in
 * Ink (lime at low strength), ruled and dotted paper in Paper, and the aurora
 * in Spectra. All are decoration, none holds text, and all stay still when
 * the person asked for less motion.
 */
export function SignInGround() {
  const direction = useDirection();
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {direction === "ink" ? (
        <Dither cell={4} strength={0.34} className="text-ring" />
      ) : null}
      {direction === "paper" ? (
        <DotPattern
          gap={24}
          radius={1.25}
          fade={false}
          className="text-(--border-strong)"
        />
      ) : null}
      {direction === "spectra" ? <Aurora height={0.55} opacity={0.6} /> : null}
    </div>
  );
}
