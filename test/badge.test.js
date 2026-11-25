import test from 'node:test'
import assert from 'node:assert/strict'
import { MILESTONES } from '../src/core/milestones.js'
import { BADGE_KINDS, TIER_NAMES, achievementSvg } from '../src/core/render/badge.js'

test('every milestone has a badge: an icon for what it counts and a metal for how far along it is', () => {
  assert.deepEqual([...BADGE_KINDS].sort(), [...new Set(MILESTONES.map(m => m.kind))].sort(), 'one icon for each thing that is counted')
  for (const m of MILESTONES) {
    assert.ok(BADGE_KINDS.includes(m.kind) && m.tier >= 0 && m.tier < TIER_NAMES.length, m.id)
    assert.ok(achievementSvg({ kind: m.kind, tier: m.tier }).startsWith('<svg'), m.id)
  }
  // Within a kind the tiers go up with the goal: more is a better metal.
  for (const kind of BADGE_KINDS) {
    const tiers = MILESTONES.filter(m => m.kind === kind)
    assert.deepEqual(tiers.map(m => m.tier), tiers.map((_, i) => i), kind + ' climbs bronze, silver, gold, diamond')
    assert.deepEqual(tiers.map(m => m.n), [...tiers.map(m => m.n)].sort((a, b) => a - b))
  }
})

test('a badge is a small crisp SVG; one not reached is grey with a padlock, and a title is escaped', () => {
  const colors = svg => new Set([...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map(m => m[1]))
  for (const kind of BADGE_KINDS) {
    const reached = achievementSvg({ kind, tier: 2, size: 80 })
    const locked = achievementSvg({ kind, tier: 2, reached: false, size: 80 })
    assert.match(reached, /viewBox="0 0 20 20" width="80" height="80" shape-rendering="crispEdges"/)
    assert.ok(reached.length < 12_000, 'small (' + reached.length + ')')
    assert.notEqual(reached, locked)
    assert.ok(colors(reached).has('#f2c14e'), 'gold is gold')
    assert.ok(!colors(locked).has('#f2c14e'), 'a badge not reached has no color yet')
  }
  assert.notEqual(achievementSvg({ kind: 'tools', tier: 0 }), achievementSvg({ kind: 'tools', tier: 1 }), 'each metal looks different')
  assert.notEqual(achievementSvg({ kind: 'tools', tier: 3 }), achievementSvg({ kind: 'tools', tier: 3, reached: false }))
  assert.ok(achievementSvg({ kind: 'tools', title: 'A<b>&"x' }).includes('<title>A&lt;b&gt;&amp;&quot;x</title>'))
  assert.equal(achievementSvg({ kind: 'nope' }), achievementSvg({ kind: 'tools' }), 'an unknown kind draws the default icon')
})
