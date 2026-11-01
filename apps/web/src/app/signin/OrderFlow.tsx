/**
 * The order flow: a document moves through read, decide and approve, then the
 * loop starts again. Origin: drawn for OrderPilot in plain SVG and CSS, no
 * third-party code. Colours are the design tokens. The base rules in
 * order-flow.css are the still frame; the animation runs only while
 * data-motion is "on", which needs no reduced-motion preference. It pauses
 * while the tab is hidden.
 */
import { useTranslation } from "react-i18next";
import { FlowIcon, type FlowStage } from "./FlowIcon";
import { REDUCED_MOTION, useMediaQuery } from "./useMediaQuery";
import { usePageVisible } from "./usePageVisible";
import "./order-flow.css";

const STAGES: { stage: FlowStage; x: number; who: string }[] = [
  { stage: "read", x: 60, who: "ai" },
  { stage: "decide", x: 240, who: "rules" },
  { stage: "approve", x: 420, who: "people" },
];

export function OrderFlow() {
  const { t } = useTranslation("signin");
  const reduced = useMediaQuery(REDUCED_MOTION);
  const visible = usePageVisible();

  return (
    <svg
      viewBox="0 0 480 200"
      className="of block size-full"
      data-motion={reduced ? "still" : "on"}
      data-paused={visible ? "false" : "true"}
      focusable="false"
    >
      <path d="M60 112H420" className="of-track" />
      <path d="M84 112H216" pathLength="1" className="of-seg of-seg1" />
      <path d="M264 112H396" pathLength="1" className="of-seg of-seg2" />

      {STAGES.map(({ stage, x, who }, index) => (
        <g key={stage} transform={`translate(${String(x)} 112)`}>
          <circle r="24" className="of-node" />
          <g className="of-icon" transform="translate(-12 -12)">
            <FlowIcon stage={stage} />
          </g>
          <g className={`of-lit of-lit${String(index + 1)}`}>
            <circle r="24" className="of-node-lit" />
            <g className="of-icon-lit" transform="translate(-12 -12)">
              <FlowIcon stage={stage} />
            </g>
          </g>
          <text y="52" textAnchor="middle" className="of-title">
            {t(`flow.${stage}`)}
          </text>
          <text y="69" textAnchor="middle" className="of-who">
            {t(`flow.${who}`)}
          </text>
        </g>
      ))}

      <g className="of-doc">
        <g className="of-doc-fade">
          <path d="M0 62V86" className="of-drop" />
          <rect
            x="-18"
            y="12"
            width="36"
            height="50"
            rx="5"
            className="of-sheet"
          />
          <path
            d="M-10 24h20M-10 32h20M-10 40h13M-10 48h16"
            className="of-lines"
          />
          <path d="M-10 27.5h20" className="of-beam" />
          <path
            d="m6 22 2 2 3.5-4M6 30l2 2 3.5-4M6 38l2 2 3.5-4"
            className="of-ticks"
          />
          <g className="of-badge">
            <circle cx="17" cy="12" r="8" />
            <path d="m13.5 12 2.5 2.5 4.5-5" />
          </g>
        </g>
      </g>
    </svg>
  );
}
