import { lazy, Suspense, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { logout } from "@/lib/api/auth";
import { anyFormDirty } from "@/lib/dirty-forms";

// Only needed when someone signs out over unsaved changes.
const SignOutDialog = lazy(() =>
  import("./SignOutDialog").then((m) => ({ default: m.SignOutDialog })),
);

/**
 * Signing out, in one place for the account menu and the Settings page.
 * Signing out deletes the drafts on this device, so unsaved changes are asked
 * about first. Render `dialog` once beside the control that calls
 * `requestSignOut`.
 */
export function useSignOut(): {
  requestSignOut: () => void;
  signingOut: boolean;
  dialog: ReactNode;
} {
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  // Loaded on the first ask, then kept so that closing can return focus.
  const [askedOnce, setAskedOnce] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  function signOut() {
    setAsking(false);
    setSigningOut(true);
    // logout() rejects when the server call fails, but it has already ended
    // the session here, so the person goes to the sign-in page either way.
    void logout()
      .catch(() => undefined)
      .then(() => {
        setSigningOut(false);
        void navigate("/login");
      });
  }

  function requestSignOut() {
    if (anyFormDirty()) {
      setAskedOnce(true);
      setAsking(true);
    } else signOut();
  }

  const dialog = askedOnce ? (
    <Suspense fallback={null}>
      <SignOutDialog
        open={asking}
        onKeep={() => {
          setAsking(false);
        }}
        onSignOut={signOut}
      />
    </Suspense>
  ) : null;

  return { requestSignOut, signingOut, dialog };
}
