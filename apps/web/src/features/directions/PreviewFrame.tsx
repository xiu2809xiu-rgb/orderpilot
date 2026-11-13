import { Navigate, useParams } from "react-router";
import { ContentRegion } from "./frame/ContentRegion";
import { PreviewBar } from "./frame/PreviewBar";
import { Shell } from "./shell/Shell";
import {
  DEFAULT_SCREEN,
  findScreen,
  screenPath,
  type ScreenDef,
} from "./screens";

/**
 * The route element of /preview/:screen: a prototype screen in the product's
 * design, with the tag that says it is not a real page yet, and the shell
 * (side panel and top bar) around it. The screens are lazy chunks; this one
 * is too, so only a person who opens a preview downloads any of it.
 */
export function PreviewFrame() {
  const { screen } = useParams();
  const def = findScreen(screen);
  if (!def) return <Navigate to={screenPath(DEFAULT_SCREEN)} replace />;
  return <Frame screen={def} />;
}

function Frame({ screen }: { screen: ScreenDef }) {
  return (
    <div className="flex h-dvh flex-col">
      <PreviewBar />
      {screen.id === "signin" ? (
        // Nobody is signed in on this page, so it has no side panel or top bar.
        <ContentRegion screen={screen} />
      ) : (
        <Shell screen={screen.id}>
          <ContentRegion screen={screen} />
        </Shell>
      )}
    </div>
  );
}
