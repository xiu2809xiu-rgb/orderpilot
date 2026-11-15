/**
 * A customer's name in a home table. In the table it is capped at one line, so a
 * long name cannot push the amount out of view, and the full name is in the
 * title. In the stacked rows there is room, so it is shown whole.
 */
export function CustomerName({ name }: { name: string | null | undefined }) {
  if (!name) return null;
  return (
    <span
      className="block in-[table]:max-w-52 in-[table]:truncate"
      title={name}
    >
      {name}
    </span>
  );
}
