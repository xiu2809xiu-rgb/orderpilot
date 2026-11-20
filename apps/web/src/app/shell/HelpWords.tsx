import { useTranslation } from "react-i18next";
import { GLOSSARY_KEYS } from "@/components/common/Term";

/** The part of Help that says what the abbreviations and phrases of the screens mean. */
export function HelpWords({ headingId }: { headingId: string }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby={headingId} className="mt-4 border-t pt-3">
      <h2 id={headingId} className="fs-14 mb-2 font-semibold">
        {t("shell.help.wordsTitle")}
      </h2>
      <dl className="fs-14 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {GLOSSARY_KEYS.map((key) => {
          const long = t(`glossary.${key}.long`, { defaultValue: "" });
          const meaning = t(`glossary.${key}.meaning`);
          return (
            <div key={key}>
              <dt className="font-medium">{t(`glossary.${key}.term`)}</dt>
              <dd className="text-muted-foreground">
                {long ? `${long}. ${meaning}` : meaning}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
