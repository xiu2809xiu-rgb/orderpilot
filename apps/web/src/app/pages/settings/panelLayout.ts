/**
 * How a Settings panel stacks its groups (its cards). The space between
 * groups is one step above the 32 px it was (48 px), and a list with
 * `SettingList tight` puts 16 px above and below each row except the first
 * and the last, so two rows are 32 px apart (they were 48). The card's own
 * edge padding is unchanged. Every panel takes it from here; the Account
 * panel can later.
 */
export const PANEL_GROUPS = "flex flex-col gap-s6";
