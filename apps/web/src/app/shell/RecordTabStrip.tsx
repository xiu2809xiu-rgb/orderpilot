import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useRecordTabs, type RecordTab as Tab } from "@/stores/recordTabs";
import { CloseTabDialog } from "./CloseTabDialog";
import { RECORD_TABS_HINT_ID, RecordTab } from "./RecordTab";

const MOVES: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index) => index + 1,
  ArrowLeft: (index) => index - 1,
  Home: () => 0,
  End: (_, count) => count - 1,
};

/**
 * The strip of open records under the top bar. It loads after the first paint,
 * in a chunk of its own that the entry bundle does not carry. One Tab stop:
 * the arrow keys move along it and Delete closes the focused tab.
 */
export default function RecordTabStrip({
  activeKey,
}: {
  activeKey: string | undefined;
}) {
  const { t } = useTranslation("record-tabs");
  const navigate = useNavigate();
  const tabs = useRecordTabs((state) => state.tabs);
  const closeTab = useRecordTabs((state) => state.close);
  const [focused, setFocused] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Tab | null>(null);
  const links = useRef(new Map<string, HTMLAnchorElement>());
  // A close removes the focused element, so the next render puts the focus somewhere real.
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    links.current.get(target)?.focus();
  });

  useEffect(() => {
    if (!activeKey) return;
    // "nearest" scrolls only when the tab is out of view, and never smoothly. The
    // whole item is brought in, so its close button is never left past the edge.
    links.current
      .get(activeKey)
      ?.closest("li")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeKey, tabs.length]);

  if (tabs.length === 0) return null;

  const rovingKey = tabs.some((tab) => tab.key === focused)
    ? focused
    : tabs.some((tab) => tab.key === activeKey)
      ? activeKey
      : tabs[0]?.key;

  function finishClose(tab: Tab) {
    const index = tabs.findIndex((each) => each.key === tab.key);
    const next = tabs[index - 1] ?? tabs[index + 1] ?? null;
    closeTab(tab.key);
    setConfirming(null);
    if (next) {
      pendingFocus.current = next.key;
    } else {
      // The last tab takes the whole strip with it, so there is no effect left to move the focus.
      document.getElementById("main")?.focus();
    }
    if (tab.key === activeKey) void navigate(next ? next.to : tab.listPath);
  }

  function requestClose(tab: Tab) {
    if (tab.dirty) setConfirming(tab);
    else finishClose(tab);
  }

  function onKeyDown(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    const tab = tabs[index];
    if (!tab) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      requestClose(tab);
      return;
    }
    const move = MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    const count = tabs.length;
    const target = tabs[(move(index, count) + count) % count];
    if (target) links.current.get(target.key)?.focus();
  }

  return (
    <nav aria-label={t("label")} className="shrink-0 border-b bg-background">
      <p id={RECORD_TABS_HINT_ID} className="sr-only">
        {t("hint")}
      </p>
      <ul
        className="flex items-center gap-1 overflow-x-auto scroll-px-s2 px-s2 py-1 [scrollbar-width:thin]"
        onWheel={(event) => {
          // A mouse wheel has no sideways motion: turn it into one here.
          if (event.deltaX === 0)
            event.currentTarget.scrollLeft += event.deltaY;
        }}
      >
        {tabs.map((tab, index) => (
          <li key={tab.key} className="shrink-0">
            <RecordTab
              tab={tab}
              active={tab.key === activeKey}
              focusable={tab.key === rovingKey}
              linkRef={(element) => {
                if (element) links.current.set(tab.key, element);
                else links.current.delete(tab.key);
              }}
              onKeyDown={(event) => {
                onKeyDown(event, index);
              }}
              onFocus={() => {
                setFocused(tab.key);
              }}
              onClose={() => {
                requestClose(tab);
              }}
            />
          </li>
        ))}
      </ul>
      <CloseTabDialog
        name={
          confirming
            ? t("name", {
                kind: t(`kinds.${confirming.kind}`),
                no: confirming.no,
              })
            : null
        }
        onKeep={() => {
          if (confirming) pendingFocus.current = confirming.key;
          setConfirming(null);
        }}
        onClose={() => {
          if (confirming) finishClose(confirming);
        }}
      />
    </nav>
  );
}
