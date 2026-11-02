// A registry of forms with unsaved changes, so that something outside a form,
// such as signing out, can ask before it takes the changes away.
const forms = new Set<() => boolean>();

/** Registers a form's "is it changed?" check. Returns the way to unregister. */
export function registerDirtyForm(isDirty: () => boolean): () => void {
  forms.add(isDirty);
  return () => {
    forms.delete(isDirty);
  };
}

/** True when any open form holds changes that were not saved. */
export function anyFormDirty(): boolean {
  return [...forms].some((isDirty) => isDirty());
}
