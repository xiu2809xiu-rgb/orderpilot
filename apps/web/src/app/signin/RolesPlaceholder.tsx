import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the card holds while the demo roles are on their way: the same parts
 * in the same sizes as the roles will take (title, hint, six buttons, the
 * "More roles" control; the form's own toggle is held by SignInForm), so the card does not change height when they arrive,
 * and the email form is not drawn first only to fold away. The words are for
 * a screen reader, which cannot see the placeholder.
 */
export function RolesPlaceholder() {
  const { t } = useTranslation("signin");
  return (
    <div
      role="status"
      aria-busy="true"
      data-testid="roles-placeholder"
      className="flex flex-col gap-3"
    >
      <span className="sr-only">{t("login.loadingRoles")}</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="flex flex-col">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-full max-w-72" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-[8.17rem] sm:h-31" />
          ))}
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}
