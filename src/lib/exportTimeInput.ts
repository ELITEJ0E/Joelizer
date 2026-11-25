/** Converts compact editor timestamps without requiring punctuation.
 * 040185 -> 04:01.85; 012385 -> 01:23.85.
 * Up to four digits without punctuation are interpreted as MM:SS (e.g. 0123).
 * One or two digits remain whole seconds for fast entry.
 */
export function parseExportTimeInput(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^\d{5,6}$/.test(raw)) {
    const ms = raw.padStart(6, '0');
    const minutes = Number(ms.slice(0, -4));
    const seconds = Number(ms.slice(-4, -2));
    const centiseconds = Number(ms.slice(-2));
    return seconds < 60 ? minutes * 60 + seconds + centiseconds / 100 : null;
  }
  if (/^\d{3,4}$/.test(raw)) {
    const code = raw.padStart(4, '0');
    const seconds = Number(code.slice(-2));
    return seconds < 60 ? Number(code.slice(0, -2)) * 60 + seconds : null;
  }
  const parts = raw.split(':');
  if (parts.length > 3 || parts.some(part => !/^\d+(?:\.\d+)?$/.test(part))) return null;
  // Text such as "83.25" is still interpreted as an absolute number of seconds.
  const values = parts.map(Number);
  if (parts.length > 1 && (values.slice(1).some(n => n >= 60))) return null;
  const seconds = values.reduce((sum, number) => sum * 60 + number, 0);
  return Number.isFinite(seconds) ? seconds : null;
}
