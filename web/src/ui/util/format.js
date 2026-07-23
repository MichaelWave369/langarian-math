/**
 * Exact-value formatting helpers. The workbench is a scientific instrument:
 * numbers shown as "exact" are full-precision, never silently rounded.
 */

/** Full-precision shortest round-trip representation of a finite number. */
export function fmtExact(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value)
  return String(value)
}

/** Rounded display for compact readouts (labeled as rounded). */
export function fmtShort(value, digits = 6) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value)
  return Number(value.toPrecision(digits)).toString()
}

/** Exact complex component text: "re + imi" with full precision. */
export function fmtCx(z) {
  return `${fmtExact(z.re)} ${z.im < 0 ? '-' : '+'} ${fmtExact(Math.abs(z.im))}i`
}

/** Copy text to the clipboard; throws a surfaced error on failure. */
export async function copyText(text) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(area)
  }
}

/** Trigger a client-side download of a text file. */
export function downloadText(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
