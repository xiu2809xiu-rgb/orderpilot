import { CircleCheck, Clock, Info, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Section } from "../../parts/Section";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "../Alert";
import { Badge } from "../Badge";
import { FileType } from "../FileType";
import { Frame, FrameDescription, FramePanel, FrameTitle } from "../Frame";
import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
} from "../Stepper";
import {
  Timeline,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "../Timeline";
import { ItemCard } from "./ItemCard";

const STEPS = ["po", "stock", "pi", "sent"] as const;
const FILES = [
  ["po-boxed-so-0102.pdf", "pdf"],
  ["stock-list.xlsx", "xlsx"],
  ["lines.csv", "csv"],
  ["warehouse-photo.jpg", "jpg"],
  ["packing-scan.png", "png"],
] as const;

/** ReUI: the structure of the product screens. */
export function ReuiSection() {
  const { t } = useTranslation("directions-kit-items");
  const labels = {
    completed: t("demo.stepper.completed"),
    active: t("demo.stepper.active"),
    inactive: t("demo.stepper.inactive"),
  };
  return (
    <Section
      id="kit-reui"
      title={t("vendors.reui.title")}
      intro={t("vendors.reui.intro")}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ItemCard
          item="stepper"
          vendor="reui"
          align="start"
          scroll
          className="sm:col-span-2 xl:col-span-2"
        >
          <Stepper
            value={3}
            label={t("demo.stepper.journey")}
            labels={labels}
            className="min-w-xl"
          >
            {STEPS.map((step, index) => (
              <StepperItem key={step} step={index + 1}>
                <StepperIndicator />
                <div className="min-w-0 pr-2 text-left">
                  <StepperTitle>{t(`demo.stepper.steps.${step}`)}</StepperTitle>
                  {index === 2 ? (
                    <StepperDescription>
                      {t("demo.stepper.waiting")}
                    </StepperDescription>
                  ) : null}
                </div>
                <StepperSeparator />
              </StepperItem>
            ))}
          </Stepper>
        </ItemCard>
        <ItemCard item="timeline" vendor="reui" align="start">
          <Timeline value={2}>
            {STEPS.slice(0, 3).map((step, index) => (
              <TimelineItem key={step} step={index + 1}>
                <TimelineIndicator />
                <TimelineSeparator />
                <TimelineHeader>
                  <TimelineTitle>
                    {t(`demo.stepper.steps.${step}`)}
                  </TimelineTitle>
                </TimelineHeader>
                {index === 2 ? (
                  <TimelineContent>{t("demo.stepper.waiting")}</TimelineContent>
                ) : null}
              </TimelineItem>
            ))}
          </Timeline>
        </ItemCard>
        <ItemCard item="badge" vendor="reui">
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="success">
              <CircleCheck aria-hidden="true" />
              {t("demo.badge.paid")}
            </Badge>
            <Badge variant="warning">
              <Clock aria-hidden="true" />
              {t("demo.badge.hold")}
            </Badge>
            <Badge variant="destructive">
              <TriangleAlert aria-hidden="true" />
              {t("demo.badge.late")}
            </Badge>
            <Badge variant="info">
              <Info aria-hidden="true" />
              {t("demo.badge.draft")}
            </Badge>
          </div>
        </ItemCard>
        <ItemCard item="frame" vendor="reui">
          <Frame className="w-full text-left">
            <FramePanel>
              <FrameTitle>{t("demo.frame.title")}</FrameTitle>
              <FrameDescription>{t("demo.frame.description")}</FrameDescription>
            </FramePanel>
          </Frame>
        </ItemCard>
        <ItemCard item="fileType" vendor="reui" align="start">
          <ul className="flex flex-col gap-1.5">
            {FILES.map(([name, key]) => (
              <li key={name} className="flex items-center gap-2">
                <FileType
                  name={name}
                  size={24}
                  label={t(`demo.files.${key}`)}
                />
                <span className="fs-14 text-foreground">{name}</span>
              </li>
            ))}
          </ul>
        </ItemCard>
        <ItemCard
          item="alert"
          vendor="reui"
          align="start"
          className="sm:col-span-2 xl:col-span-3"
        >
          <Alert variant="warning" className="text-left">
            <AlertTitle>{t("demo.alert.title")}</AlertTitle>
            <AlertDescription>{t("demo.alert.description")}</AlertDescription>
            <AlertAction>
              <Button size="sm" variant="outline">
                {t("demo.alert.action")}
              </Button>
            </AlertAction>
          </Alert>
        </ItemCard>
      </div>
    </Section>
  );
}
