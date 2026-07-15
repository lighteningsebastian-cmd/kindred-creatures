/**
 * Tiny className joiner: filters out falsy values and joins with a space.
 * Keeps the design system dependency-free (no clsx / tailwind-merge).
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
