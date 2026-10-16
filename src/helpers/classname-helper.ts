/**
 * `cn` — a tiny class-name joiner used by the UI components.
 *
 * Accepts strings, arrays and `{ className: boolean }` maps and returns a
 * single, de-duplicated class string. It intentionally avoids a runtime
 * dependency so the Mini App bundle stays small.
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | { [key: string]: boolean | null | undefined };

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];

  const walk = (value: ClassValue): void => {
    if (!value && value !== 0) return;

    if (typeof value === 'string' || typeof value === 'number') {
      for (const token of String(value).split(/\s+/)) {
        if (token) out.push(token);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }

    if (typeof value === 'object') {
      for (const [key, enabled] of Object.entries(value)) {
        if (enabled) out.push(key);
      }
    }
  };

  for (const input of inputs) walk(input);

  return Array.from(new Set(out)).join(' ');
}
