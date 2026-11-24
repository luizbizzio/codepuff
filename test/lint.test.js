import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Mistakes the engine's tests cannot see, because they only show in the real window: a Box's width and height are in terminal
// cells (a number of pixels asks for a huge box and the band disappears), and an Svg drawn interactively needs its size.
const hooks = join(import.meta.dirname, '..', 'hooks')
const sources = readdirSync(hooks).filter(name => /\.tsx?$/.test(name) && !/\.test\./.test(name)).map(name => [name, readFileSync(join(hooks, name), 'utf8')])

// (A minimum width in cells is fine: a status block that keeps its width. Width and height are the ones that were mistaken for pixels.)
test('no Box in the mod is given a numeric width or height (they are cells, not pixels)', () => {
  for (const [name, text] of sources) {
    for (const [tag] of text.matchAll(/<Box\b[^>]*>/g)) {
      assert.ok(!/\b(width|height|minHeight)=\{/.test(tag), `${name}: ${tag.slice(0, 80)} sizes a Box in pixels`)
    }
  }
})

test('every Svg drawn interactively says how big it is', () => {
  for (const [name, text] of sources) {
    for (const [tag] of text.matchAll(/<Svg\b[^>]*\/>/g)) {
      if (!tag.includes('isInteractive')) continue
      assert.ok(/width=\{|\.\.\.sizeOf\(/.test(tag), `${name}: an interactive Svg needs its width and height: ${tag.slice(0, 80)}`)
    }
  }
})

test('the files that ship are listed, and every listed one exists', () => {
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'))
  for (const entry of pkg.files) {
    assert.ok(existsSync(join(import.meta.dirname, '..', entry)), entry + ' in package.json files exists')
  }
})
