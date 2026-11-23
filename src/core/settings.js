// The pet's identity and appearance: one small, versioned document per installation (pet.json).
// It is deliberately separate from statistics: resetting one never touches the other.

import { isHex } from './color.js'
import { CHARACTER_IDS, CHARACTER_NAMES } from './art/defaults.js'

export const PET_SCHEMA = 2
export const NAME_MAX = 16
export const CHARACTERS = CHARACTER_IDS
export const DEFAULT_CHARACTER = 'alpha'
export const DEFAULT_NAMES = CHARACTER_NAMES
export const STYLES = ['pixel', '3d']

// Line breaks become spaces; control characters, zero-width and bidirectional marks and markup characters are dropped.
const LINE_BREAKS = new RegExp('[\\r\\n\\t\\u2028\\u2029]', 'g')
const UNSAFE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069<>&"`]', 'g')

/** Makes a name safe to store and draw: single line, no markup, 1..16 characters; '' means "use the default". */
export function cleanName(input) {
  const text = String(input ?? '')
    .replace(LINE_BREAKS, ' ')
    .replace(UNSAFE, '')
    .replace(/\s+/g, ' ')
    .trim()
  return [...text].slice(0, NAME_MAX).join('').trim()
}

const newId = () => {
  const bytes = new Uint8Array(8)
  globalThis.crypto?.getRandomValues?.(bytes)
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('') || Math.random().toString(16).slice(2, 18)
}

/** A brand-new pet. */
export function defaultPet(now = Date.now()) {
  return {
    v: PET_SCHEMA,
    id: newId(),
    createdAt: now,
    name: '',
    character: DEFAULT_CHARACTER,
    colors: { body: null, accent: null },
    prefs: { motion: 'auto', scope: 'session', line: false, band: true, style: 'pixel' },
  }
}

/** Restores the look only: character, style, name and colors back to defaults; birthday and id are kept. */
export function restoreAppearance(pet) {
  return { ...pet, name: '', character: DEFAULT_CHARACTER, colors: { body: null, accent: null }, prefs: { ...pet.prefs, style: 'pixel' } }
}

/**
 * Turns anything that was read from disk (or imported) into a valid pet, field by field, so a damaged
 * or older file degrades to defaults instead of breaking the pet. Returns `{ pet, repaired }`.
 */
export function sanitizePet(raw, now = Date.now()) {
  const fresh = defaultPet(now)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { pet: fresh, repaired: true }
  const migrated = migratePet(raw)
  const pet = {
    v: PET_SCHEMA,
    id: typeof migrated.id === 'string' && /^[a-f0-9]{8,32}$/.test(migrated.id) ? migrated.id : fresh.id,
    createdAt: Number.isFinite(migrated.createdAt) && migrated.createdAt > 0 && migrated.createdAt <= now + 86_400_000 ? Math.floor(migrated.createdAt) : fresh.createdAt,
    name: cleanName(migrated.name),
    character: CHARACTERS.includes(migrated.character) ? migrated.character : fresh.character,
    colors: {
      body: isHex(migrated.colors?.body) ? migrated.colors.body.toLowerCase() : null,
      accent: isHex(migrated.colors?.accent) ? migrated.colors.accent.toLowerCase() : null,
    },
    prefs: {
      motion: migrated.prefs?.motion === 'reduced' ? 'reduced' : 'auto',
      scope: migrated.prefs?.scope === 'all' ? 'all' : 'session',
      line: migrated.prefs?.line === true,
      band: migrated.prefs?.band !== false,
      style: migrated.prefs?.style === '3d' ? '3d' : 'pixel',
    },
  }
  const repaired = JSON.stringify(pet) !== JSON.stringify({ ...raw, v: PET_SCHEMA })
  return { pet, repaired }
}

/**
 * Upgrades older files.
 * v1 -> v2: the single "puff" character became "Puff Alpha" (`alpha`); `prefs.style` and `prefs.band` were added.
 * A file from a newer version is read for the fields understood.
 */
function migratePet(raw) {
  const version = Number.isInteger(raw.v) ? raw.v : 1
  if (version > PET_SCHEMA) return raw
  if (version < 2) return { ...raw, character: raw.character === 'puff' ? 'alpha' : raw.character }
  return raw
}

export const displayName = pet => pet.name || DEFAULT_NAMES[pet.character] || DEFAULT_NAMES[DEFAULT_CHARACTER]
