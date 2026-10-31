// Known accessibility faults. The config must report each one as an error.

export function Logo() {
  return <img src="/logo.svg" />;
}

export function Save(props: { onSave: () => void }) {
  return <div onClick={props.onSave}>Save</div>;
}
