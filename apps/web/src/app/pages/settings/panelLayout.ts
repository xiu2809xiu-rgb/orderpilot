/**
 * How a Settings panel stacks its groups (its cards). The space between
 * groups is one step above the 32 px it was, and a group's own rows sit closer
 * (`SettingList tight`), so that a group's end shows by more than its edge.
 * Every panel takes it from here; the Account panel can later.
 */
export const PANEL_GROUPS = "flex flex-col gap-s6";
