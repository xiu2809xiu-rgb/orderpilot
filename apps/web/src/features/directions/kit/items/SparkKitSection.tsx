import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Section } from "../../parts/Section";
import {
  useOrbTokens,
  webglLook,
  type OrbState,
} from "../../spark/orb/orbPalette";
import { SparkOrb, type Engine } from "../../spark/orb/SparkOrb";
import { FileDropzone } from "../FileDropzone";
import { Orb } from "../Orb";
import { PromptBar } from "../PromptBar";
import { ItemCard } from "./ItemCard";
import "../../spark/spark.css";

const STATES = ["idle", "thinking"] as const;

/** The parts of the upload screen and Spark: the drop zone, the prompt bar and both orbs. */
export function SparkKitSection() {
  const { t } = useTranslation("directions-kit-items");
  const [chosen, setChosen] = useState<number | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [state, setState] = useState<OrbState>("idle");
  const [engine, setEngine] = useState<Engine | null>(null);
  const tokens = useOrbTokens();
  const look = webglLook(tokens, state);
  const chosenLine =
    chosen === null
      ? t("demo.drop.none")
      : t(chosen === 1 ? "demo.drop.chosen_one" : "demo.drop.chosen_other", {
          count: chosen,
        });
  return (
    <Section
      id="kit-spark"
      title={t("vendors.spark.title")}
      intro={t("vendors.spark.intro")}
    >
      <div
        role="group"
        aria-label={t("demo.orb.switch")}
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <span className="fs-14 text-muted-foreground">
          {t("demo.orb.switch")}
        </span>
        {STATES.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={state === value ? "default" : "outline"}
            aria-pressed={state === value}
            className="pointer-coarse:h-11"
            onClick={() => {
              setState(value);
            }}
          >
            {t(`demo.orb.${value}`)}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ItemCard item="fileDropzone" vendor="reui">
          <FileDropzone
            title={t("demo.drop.title")}
            draggingTitle={t("demo.drop.dragging")}
            hint={t("demo.drop.hint")}
            chooseLabel={t("demo.drop.choose")}
            inputLabel={t("demo.drop.input")}
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv"
            onFiles={(files) => {
              setChosen(files.length);
            }}
            className="w-full py-6"
          />
          <span role="status" className="fs-14 text-muted-foreground">
            {chosenLine}
          </span>
        </ItemCard>
        <ItemCard item="promptBar" vendor="bits">
          <div className="w-full text-left">
            <PromptBar
              label={t("demo.prompt.label")}
              placeholder={t("demo.prompt.placeholder")}
              sendLabel={t("demo.prompt.send")}
              stopLabel={t("demo.prompt.stop")}
              help={t("demo.prompt.help")}
              onSend={setSent}
            />
          </div>
          <span role="status" className="fs-14 text-muted-foreground">
            {sent === null
              ? t("demo.prompt.idle")
              : t("demo.prompt.sent", { text: sent })}
          </span>
        </ItemCard>
        <ItemCard item="orb" vendor="bits">
          <div
            role="img"
            aria-label={t(
              `demo.orb.label${state === "idle" ? "Idle" : "Thinking"}`,
            )}
            className="relative size-40"
          >
            <div
              className={cn(
                "absolute",
                look.disc ? "spark-orb-disc" : "inset-0",
              )}
            >
              <Orb
                colours={look.colours}
                ground={look.ground}
                thinking={state === "thinking"}
              />
            </div>
          </div>
        </ItemCard>
        <ItemCard item="liquidOrb" vendor="orb">
          <SparkOrb
            state={state}
            label={t(`demo.orb.label${state === "idle" ? "Idle" : "Thinking"}`)}
            className="size-40"
            onEngine={setEngine}
          />
          <span role="status" className="fs-14 text-muted-foreground">
            {engine === null
              ? t("demo.orb.pending")
              : t("demo.orb.engine", {
                  engine: t(`demo.orb.engines.${engine}`),
                })}
          </span>
        </ItemCard>
      </div>
    </Section>
  );
}
