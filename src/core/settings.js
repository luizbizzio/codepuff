// The pet's identity and appearance: one small, versioned document per installation (pet.json).
// It is deliberately separate from statistics: resetting one never touches the other.

import { isHex } from './color.js'
import { CHARACTER_IDS, CHARACTER_NAMES } from './art/defaults.js'
import { LANGUAGE_CODES } from './i18n/index.js'
import { ACCESSORY_IDS, FRAME_IDS } from './rewards.js'

const PET_SCHEMA = 2
export const NAME_MAX = 16
export const CHARACTERS = CHARACTER_IDS
const DEFAULT_CHARACTER = 'classic'
export const DEFAULT_NAMES = CHARACTER_NAMES
/** The sounds the pet can play, and the moments it plays them at (each moment takes any of the sounds, or none). */
export const SOUNDS = Object.freeze(['off', 'chime', 'bell', 'pop', 'ding', 'tada'])
/** How loud the sounds are (there is a clip for each sound at each level; see scripts/make-sounds.mjs). */
export const VOLUMES = Object.freeze(['low', 'medium', 'high'])
/** question: the agent asks you something; finish: a turn ends well; reset5h and resetWeek: the plan's 5-hour or weekly limit has reset. */
/** How much the pet moves: full (livelier sways), calm (the default), or reduced (still). */
export const MOTIONS = Object.freeze(['full', 'calm', 'reduced'])
/** When the plan's limit bars show: always both windows (the default), only once half of a window is used (auto), only the 5-hour one, only the weekly one, or never. */
export const PLAN_MODES = Object.freeze(['auto', 'always', 'five_hour', 'seven_day', 'off'])
/** The break reminder: after `breakEvery` minutes of work (0 is never; from 15 minutes to 8 hours) without a pause of `breakRest` minutes. */
export const BREAK_MIN = 15
export const BREAK_MAX = 480
export const REST_MIN = 5
export const REST_MAX = 60
export const BREAK_STEP = 15
/** What the buttons offer (the arrows go in steps of fifteen minutes anywhere in between). */
export const BREAK_PRESETS = Object.freeze([30, 45, 60, 90, 120, 180, 240])
export const REST_PRESETS = Object.freeze([5, 10, 15, 20, 30])
const OLD_BREAKS = { '1h': 60, '2h': 120, '3h': 180 }
const breakEveryOf = prefs => {
  const n = prefs?.breakEvery
  if (Number.isFinite(n)) return n < BREAK_MIN ? 0 : Math.min(BREAK_MAX, Math.round(n))
  return OLD_BREAKS[prefs?.breaks] ?? 0 // (an earlier version had "off", "1h", "2h" and "3h")
}
const breakRestOf = prefs => (Number.isFinite(prefs?.breakRest) ? Math.max(REST_MIN, Math.min(REST_MAX, Math.round(prefs.breakRest))) : 10)
export const SOUND_MOMENTS = Object.freeze(['question', 'finish', 'reset5h', 'resetWeek'])
const DEFAULT_SOUNDS = Object.freeze({ question: 'pop', finish: 'tada', reset5h: 'chime', resetWeek: 'chime' })
/** How tall the compact band is (its pet is drawn this tall, and the pie column beside it), in pixels, for each size the user can pick. */
export const BAND_SIZES = Object.freeze({ small: 72, medium: 96, large: 128 })

// Line breaks become spaces; control characters, zero-width and bidirectional marks and markup characters are dropped.
const LINE_BREAKS = new RegExp('[\\r\\n\\t\\u2028\\u2029]', 'g')
const UNSAFE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069<>&"`]', 'g')

/** Makes a name safe to store and draw: single line, no markup, 1..16 characters; '' means "use the default". */
export function cleanName(input) {
  // Only text is a name: a list or an object from a hand-edited file is not turned into one.
  const text = (typeof input === 'string' ? input : '')
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
    prefs: { motion: 'calm', line: true, band: true, bandSize: 'large', sounds: { ...DEFAULT_SOUNDS }, volume: 'low', mood: true, language: 'auto', plan: 'always', accessory: 'none', frame: 'none', breakEvery: 0, breakRest: 10 },
    seen: [], // one-time notices already shown
    affection: { score: 100, day: '', at: 0 }, // how much the pet likes the user (1 to 100, shown as one to five hearts); see mood.js
    milestones: null, // the milestones already celebrated; null until the first look at the statistics (what was reached before is not celebrated)
  }
}

/** Restores the look only: character, name and colors back to defaults; birthday and id are kept. */
export function restoreAppearance(pet) {
  return { ...pet, name: '', character: DEFAULT_CHARACTER, colors: { body: null, accent: null }, prefs: pet.prefs }
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
    affection: {
      score: Number.isFinite(migrated.affection?.score) ? Math.max(1, Math.min(100, Math.round(migrated.affection.score))) : 100,
      day: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(migrated.affection?.day ?? '') ? migrated.affection.day : '',
      at: Number.isFinite(migrated.affection?.at) && migrated.affection.at > 0 ? Math.round(migrated.affection.at) : 0,
    },
    seen: Array.isArray(migrated.seen) ? [...new Set(migrated.seen.filter(id => typeof id === 'string' && id.length <= 24))].slice(0, 20) : [],
    milestones: Array.isArray(migrated.milestones) ? [...new Set(migrated.milestones.filter(id => typeof id === 'string' && id.length <= 24))].slice(0, 80) : null,
    prefs: {
      // ("auto", the old default, is calm.)
      motion: MOTIONS.includes(migrated.prefs?.motion) ? migrated.prefs.motion : 'calm',
      line: migrated.prefs?.line !== false,
      band: migrated.prefs?.band !== false,
      bandSize: Object.hasOwn(BAND_SIZES, migrated.prefs?.bandSize) ? migrated.prefs.bandSize : 'large',
      mood: migrated.prefs?.mood !== false,
      plan: PLAN_MODES.includes(migrated.prefs?.plan) ? migrated.prefs.plan : 'always',
      // What it wears (only shown once the milestone for it has been reached) and when it suggests a break.
      accessory: ACCESSORY_IDS.includes(migrated.prefs?.accessory) ? migrated.prefs.accessory : 'none',
      frame: FRAME_IDS.includes(migrated.prefs?.frame) ? migrated.prefs.frame : 'none',
      breakEvery: breakEveryOf(migrated.prefs),
      breakRest: breakRestOf(migrated.prefs),
      // "auto" follows the system's language; otherwise one of the supported codes (see i18n/).
      language: LANGUAGE_CODES.includes(migrated.prefs?.language) ? migrated.prefs.language : 'auto',
      volume: VOLUMES.includes(migrated.prefs?.volume) ? migrated.prefs.volume : 'low',
      sounds: Object.fromEntries(SOUND_MOMENTS.map(moment => [moment, SOUNDS.includes(migrated.prefs?.sounds?.[moment]) ? migrated.prefs.sounds[moment] : DEFAULT_SOUNDS[moment]])),
    },
  }
  const repaired = JSON.stringify(pet) !== JSON.stringify({ ...raw, v: PET_SCHEMA })
  return { pet, repaired }
}

/**
 * Upgrades older files.
 * v1 -> v2: the single "puff" character became "Alpha" (`alpha`); `prefs.band` was added. (A `prefs.style` of the 3D days is dropped when a file is read.)
 * A file from a newer version is read for the fields understood.
 */
function migratePet(raw) {
  const version = Number.isInteger(raw.v) ? raw.v : 1
  if (version > PET_SCHEMA) return raw
  if (version < 2) return { ...raw, character: raw.character === 'puff' ? 'alpha' : raw.character }
  return raw
}

export const displayName = pet => pet.name || DEFAULT_NAMES[pet.character] || DEFAULT_NAMES[DEFAULT_CHARACTER]
