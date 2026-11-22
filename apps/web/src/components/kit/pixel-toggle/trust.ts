/**
 * Whether a person made this click or drag. The browser marks one from a
 * person as trusted, and one a script makes is not: only a person's own
 * switch is heard. It is its own module so that a test can stand in for a
 * person, because jsdom's flag cannot be set.
 */
export function madeByPerson(event: Event): boolean {
  return event.isTrusted;
}
