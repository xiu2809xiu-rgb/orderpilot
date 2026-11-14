/**
 * A light that travels once round the edge of its parent, which must be
 * `position: relative` with its own radius. Plain CSS (signin.css): it needs no
 * script, it is not drawn under reduced motion, and a browser without
 * `offset-path: rect()` draws nothing.
 */
export function EdgeLight() {
  return (
    <div aria-hidden="true" className="signin-edge">
      <div className="signin-edge-light" />
    </div>
  );
}
