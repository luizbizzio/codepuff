// Tiny, dependency-free string hash (cyrb53). Used to store *identifiers* of projects and files without
// storing their paths. It is not cryptographic and is never used for anything secret.

export function hash(text, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

/** A path as a stable identifier: separators and case folded so one file has one id on Windows. */
export const pathId = path => hash(String(path).replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase()).slice(0, 12)

/** A short, filename-safe id for a host session id. Safe ids are kept as they are. */
export function sessionKey(id) {
  const text = String(id ?? '')
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(text) ? text : 'h-' + hash(text)
}
