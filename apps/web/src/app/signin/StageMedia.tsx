import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { QuietBoundary } from "./QuietBoundary";
import { usePoster } from "./usePoster";

// Its own chunk: the shader never loads with the form.
const DepthField = lazy(() =>
  import("@/components/kit/DepthField").then((module) => ({
    default: module.DepthField,
  })),
);

export const STAGE_TOKENS = [
  "--signin-stage-ink",
  "--signin-stage-glow",
  "--signin-stage-sky",
] as const;

const VIDEO_SOURCES = [
  { src: "/media/signin-hero.webm", type: "video/webm" },
  { src: "/media/signin-hero.mp4", type: "video/mp4" },
] as const;

interface StageMediaProps {
  paused: boolean;
  reduced: boolean;
  pointer: RefObject<{ x: number; y: number }>;
}

/**
 * What the stage shows, in order of preference: the team's video when a file
 * loads, otherwise the live scene; under reduced motion a still (the poster
 * when there is one, else one frame of the scene). The scene sits underneath
 * the video until the video has its first frame, so there is never a blank
 * frame, and a video that fails leaves the scene with nothing shown or thrown.
 */
export function StageMedia({ paused, reduced, pointer }: StageMediaProps) {
  const poster = usePoster("/media/signin-hero.jpg");
  const [video, setVideo] = useState<"trying" | "ready" | "failed">("trying");
  const failures = useRef(0);
  const element = useRef<HTMLVideoElement>(null);
  const wantsVideo = !reduced && video !== "failed";

  useEffect(() => {
    const node = element.current;
    if (!node || video !== "ready") return;
    if (paused) node.pause();
    else void Promise.resolve(node.play()).catch(() => undefined);
  }, [paused, video]);

  const mode = reduced ? "still" : video === "ready" ? "video" : "scene";
  return (
    <div className="absolute inset-0" data-stage={mode}>
      {mode === "video" ? null : (
        <QuietBoundary>
          <Suspense fallback={null}>
            <DepthField
              pointer={pointer}
              paused={paused}
              tokens={STAGE_TOKENS}
            />
          </Suspense>
        </QuietBoundary>
      )}
      {reduced && poster ? (
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      {wantsVideo ? (
        <video
          ref={element}
          aria-hidden="true"
          tabIndex={-1}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          poster={poster ?? undefined}
          className="absolute inset-0 size-full object-cover transition-opacity duration-500"
          style={{ opacity: video === "ready" ? 1 : 0 }}
          onLoadedData={() => {
            setVideo("ready");
          }}
          onError={(event) => {
            // A source's own failure is counted below; this is the video's (a file that stops decoding).
            if (event.target === event.currentTarget) setVideo("failed");
          }}
        >
          {VIDEO_SOURCES.map(({ src, type }) => (
            <source
              key={src}
              src={src}
              type={type}
              onError={() => {
                failures.current += 1;
                if (failures.current >= VIDEO_SOURCES.length)
                  setVideo("failed");
              }}
            />
          ))}
        </video>
      ) : null}
    </div>
  );
}
