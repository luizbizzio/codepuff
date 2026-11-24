// Developer tool: writes test/fixtures/art-hashes.json, a fingerprint of every character in every state (the pixels of the frame
// each state rests on, and of the whole loop). The characters test compares against it, so a change to the art that was not
// meant (a palette tweak, a sprite rebuild, an animation edit) is noticed. Run it after a change that was meant:
//   node scripts/art-hashes.mjs
import { writeFileSync } from 'node:fs'
import { artHashes } from '../test/art-hashes.js'

writeFileSync('test/fixtures/art-hashes.json', JSON.stringify(artHashes(), null, 1) + '\n')
console.log('test/fixtures/art-hashes.json')
