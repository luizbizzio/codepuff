// Developer tool: writes the short sound clips the pet can play (assets/sounds/*.wav), synthesized here so they are
// original and carry no license. 16 kHz, mono, 16 bit, at three volume levels (low, medium, high).
//   node scripts/make-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const RATE = 16000
const TAU = Math.PI * 2

/** A tone with an exponential decay, added into `out` from `start` seconds. */
function tone(out, start, freq, length, { gain = 0.4, decay = 6, partials = [[1, 1]], attack = 0.004 } = {}) {
  const from = Math.floor(start * RATE)
  const n = Math.floor(length * RATE)
  for (let i = 0; i < n && from + i < out.length; i++) {
    const t = i / RATE
    const env = Math.min(1, t / attack) * Math.exp(-decay * t)
    let v = 0
    for (const [ratio, level] of partials) v += Math.sin(TAU * freq * ratio * t) * level
    out[from + i] += v * env * gain
  }
}

const NOTE = { C5: 523.25, E5: 659.25, G5: 783.99, B5: 987.77, C6: 1046.5, E6: 1318.5, G6: 1568 }

const clips = {
  // Two rising notes: a polite "your turn".
  chime: () => { const o = new Float32Array(RATE * 0.7); tone(o, 0, NOTE.E5, 0.5, { decay: 7 }); tone(o, 0.16, NOTE.B5, 0.5, { decay: 6 }); return o },
  // A bell: a fundamental with inharmonic overtones.
  bell: () => { const o = new Float32Array(RATE * 1.1); tone(o, 0, 880, 1.0, { gain: 0.3, decay: 4, partials: [[1, 1], [2.76, 0.5], [5.4, 0.25]] }); return o },
  // A soft pop: a quick downward sweep.
  pop: () => {
    const o = new Float32Array(RATE * 0.2)
    let phase = 0
    for (let i = 0; i < o.length; i++) { const t = i / RATE; phase += TAU * (620 - 2400 * t) / RATE; o[i] = Math.sin(phase) * Math.exp(-t * 28) * 0.5 }
    return o
  },
  // A single clear ding.
  ding: () => { const o = new Float32Array(RATE * 0.7); tone(o, 0, 1318.5, 0.6, { gain: 0.35, decay: 7, partials: [[1, 1], [2, 0.3]] }); return o },
  // A small fanfare.
  tada: () => {
    const o = new Float32Array(RATE * 1.2)
    ;[NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => tone(o, i * 0.1, f, 0.3, { gain: 0.3, decay: 9, partials: [[1, 1], [2, 0.3]] }))
    ;[NOTE.C6, NOTE.E6, NOTE.G6].forEach(f => tone(o, 0.32, f, 0.8, { gain: 0.2, decay: 4, partials: [[1, 1], [2, 0.25]] }))
    return o
  },
}

/** How loud each volume level is, as a share of full scale. */
const VOLUMES = { low: 0.2, medium: 0.5, high: 0.95 }

function wav(samples, volume) {
  let peak = 0
  for (const v of samples) peak = Math.max(peak, Math.abs(v))
  // Every clip is brought to the same peak, then set to the level asked for, so the sounds are about as loud as each other.
  const scale = peak > 0 ? volume / peak : 1
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * scale)) * 32767), i * 2))
  const head = Buffer.alloc(44)
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVEfmt ', 8)
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22)
  head.writeUInt32LE(RATE, 24); head.writeUInt32LE(RATE * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34)
  head.write('data', 36); head.writeUInt32LE(data.length, 40)
  return Buffer.concat([head, data])
}

mkdirSync('assets/sounds', { recursive: true })
for (const [name, make] of Object.entries(clips)) {
  const samples = make()
  for (const [level, volume] of Object.entries(VOLUMES)) {
    const file = `assets/sounds/${name}-${level}.wav`
    writeFileSync(file, wav(samples, volume))
    console.log(file)
  }
}
