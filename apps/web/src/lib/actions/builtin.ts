import { LogOut, Moon, Sun } from "lucide-react";
import { logout } from "@/lib/api/auth";
import { useThemeStore } from "@/lib/theme";
import { registerAction } from "./registry";

// The actions every signed-in person has. Later stories register theirs the
// same way, from their feature's index.ts.
registerAction({
  id: "theme.light",
  label: "palette.themeLight",
  icon: Sun,
  keywords: ["appearance", "mode", "bright"],
  run: () => {
    useThemeStore.getState().setPreference("light");
  },
});
registerAction({
  id: "theme.dark",
  label: "palette.themeDark",
  icon: Moon,
  keywords: ["appearance", "mode", "night"],
  run: () => {
    useThemeStore.getState().setPreference("dark");
  },
});
registerAction({
  id: "session.signOut",
  label: "userMenu.signOut",
  icon: LogOut,
  keywords: ["log out", "leave", "exit"],
  run: async ({ navigate }) => {
    await logout();
    navigate("/login");
  },
});
