import { Navigate, useParams } from "react-router";
import {
  DEFAULT_DIRECTION,
  isDirection,
  screenPath,
  type Direction,
} from "./directions";
import { ContentRegion } from "./frame/ContentRegion";
import { PreviewBar } from "./frame/PreviewBar";
import { Shell } from "./shell/Shell";
import { useDirectionOnRoot } from "./frame/useDirectionOnRoot";
import { DEFAULT_SCREEN, findScreen, type ScreenDef } from "./screens";
import "./tokens/base.css";
import "./tokens/ink.css";
import "./tokens/paper.css";
import "./tokens/spectra.css";

/**
 * The route element of /directions/:direction/:screen: the preview's own bar,
 * then the shell (side panel and top bar) around the screen, on the
 * direction's ground. The three token files are
 * imported here, so only this lazy chunk carries them.
 */
export function DirectionsFrame() {
  const { direction, screen } = useParams();
  if (!isDirection(direction)) {
    return (
      <Navigate
        to={screenPath(DEFAULT_DIRECTION, screen ?? DEFAULT_SCREEN)}
        replace
      />
    );
  }
  const def = findScreen(screen);
  if (!def) {
    return <Navigate to={screenPath(direction, DEFAULT_SCREEN)} replace />;
  }
  return <Frame direction={direction} screen={def} />;
}

function Frame({
  direction,
  screen,
}: {
  direction: Direction;
  screen: ScreenDef;
}) {
  useDirectionOnRoot(direction);
  return (
    <div className="dx-ground flex h-dvh flex-col">
      <PreviewBar direction={direction} screen={screen.id} />
      {screen.id === "signin" ? (
        // Nobody is signed in on this page, so it has no side panel or top bar.
        <ContentRegion direction={direction} screen={screen} />
      ) : (
        <Shell direction={direction} screen={screen.id}>
          <ContentRegion direction={direction} screen={screen} />
        </Shell>
      )}
    </div>
  );
}
