/**
 * Ingest sanitization for user/imported strings (Lane H finding L-13).
 *
 * React already escapes rendered text, but attacker-controlled Unicode can
 * still spoof fixed chrome (status badges, tags) with bidi-override or
 * control characters. Every user-ingested string (labels, glyphs, metadata,
 * pasted arrays, DSL source, imported receipts/programs) passes through
 * stripIngest before it reaches the kernel or the renderer.
 */

/** Bidi controls: U+061C, U+200E/U+200F, U+202A..U+202E, U+2066..U+2069. */
const BIDI_RE = '[\\u061C\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]'

/** C0 controls (except tab U+0009 / newline U+000A) and C1 controls. */
const CONTROL_RE = '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]'

const BIDI_CHARS = new RegExp(BIDI_RE, 'g')
const CONTROL_CHARS = new RegExp(CONTROL_RE, 'g')

/**
 * Strip bidi and control characters from an ingested string.
 * Preserves printable Unicode, tab, and newline.
 */
export function stripIngest(text) {
  if (typeof text !== 'string') return ''
  return text.replace(BIDI_CHARS, '').replace(CONTROL_CHARS, '')
}

/** True when the string contains characters that stripIngest would remove. */
export function hasUnsafeChars(text) {
  if (typeof text !== 'string') return false
  return new RegExp(`${BIDI_RE}|${CONTROL_RE}`).test(text)
}

/**
 * Sanitize a string for use as a download filename (L-15): no path
 * traversal, no NUL/controls, no bidi, bounded length.
 */
export function sanitizeFilename(name, fallback = 'export') {
  const stripped = stripIngest(String(name ?? ''))
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
  const clipped = stripped.slice(0, 80)
  return clipped === '' ? fallback : clipped
}
