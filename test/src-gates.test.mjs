import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Durable source gates. These encode invariants of the design system and of the
 * architecture so a later plan cannot quietly break them: each failure names the
 * offending file and the rule. They read source text only; no browser.
 */

const ROOT = new URL('..', import.meta.url).pathname

function walk(dir, exts) {
  const out = []
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p, exts))
    else if (exts.some((e) => name.endsWith(e))) out.push(p)
  }
  return out
}

const rel = (p) => relative(ROOT, p)
const read = (p) => readFileSync(p, 'utf8')

const SRC = join(ROOT, 'src')
const srcFiles = walk(SRC, ['.ts', '.tsx', '.css'])
const srcCode = srcFiles.filter((f) => /\.tsx?$/.test(f))
const e2eFiles = walk(join(ROOT, 'e2e'), ['.ts'])

/** Every file whose text matches `re`, as repo-relative paths. */
function offenders(files, re) {
  return files.filter((f) => re.test(read(f))).map(rel)
}

test('gate 1: no JSX inline style objects', () => {
  const bad = offenders(srcFiles, /style=\{\{/)
  assert.deepEqual(bad, [], `inline style={{ }} found in: ${bad.join(', ')} - use tokens and shared classes`)
})

test('gate 2: no raw hex colour outside :root', () => {
  const stylesPath = join(SRC, 'styles.css')
  const bad = []
  for (const f of srcFiles) {
    let text = read(f)
    if (f === stylesPath) {
      const start = text.indexOf(':root')
      assert.ok(start >= 0, 'src/styles.css has no :root block')
      const end = text.indexOf('}', start)
      text = text.slice(0, start) + text.slice(end + 1)
    }
    if (/#[0-9a-fA-F]{3,8}\b/.test(text)) bad.push(rel(f))
  }
  assert.deepEqual(bad, [], `raw hex colour outside :root in: ${bad.join(', ')} - use a token`)
})

test('gate 3: idb-keyval is imported only by src/storage.ts', () => {
  const bad = offenders(srcFiles, /idb-keyval/).filter((f) => f !== 'src/storage.ts')
  assert.deepEqual(bad, [], `idb-keyval outside storage.ts in: ${bad.join(', ')} - persistence goes through storage.ts`)
})

test('gate 4: one source of correctness - only the player touches the marking module', () => {
  const marking = /marking\.mjs|\b(scoreQuestion|scoreAttempt|isCorrectOptionSet|isCorrectNumeric|findRule)\b/
  const bad = offenders(srcFiles, marking).filter((f) => f !== 'src/routes/Player.tsx')
  assert.deepEqual(bad, [], `marking used outside Player.tsx in: ${bad.join(', ')} - read stored correctness instead`)

  // A comparison against answer.min / answer.max is a second numeric marker.
  // `=>` is an arrow, not a comparison, hence the (?<!=) guards.
  const ref = String.raw`[\w$.?]*answer\??\.(?:min|max)\b`
  const cmp = new RegExp(String.raw`(?<!=)(?:<=?|>=?)\s*${ref}|${ref}\s*(?<!=)(?:<=?|>=?)`)
  const bad2 = offenders(srcCode, cmp)
  assert.deepEqual(bad2, [], `numeric range comparison in: ${bad2.join(', ')} - correctness has one source`)
})

test('gate 5: no innerHTML or dangerouslySetInnerHTML', () => {
  const bad = offenders(srcFiles, /innerHTML|dangerouslySetInnerHTML/)
  assert.deepEqual(bad, [], `innerHTML in: ${bad.join(', ')} - render text, not markup`)
})

test('gate 6: no bank-specific literals in src/ or e2e/', () => {
  const indexPath = join(ROOT, 'public/data/index.json')
  assert.ok(existsSync(indexPath), 'public/data/index.json missing - run npm run build:data first')
  const index = JSON.parse(read(indexPath))

  const words = new Set()
  const years = new Set()
  for (const exam of index.exams) {
    words.add(exam.slug)
    words.add(exam.label)
    for (const y of exam.years) years.add(String(y.year))
  }
  for (const [group, g] of Object.entries(index.topics)) {
    words.add(group)
    for (const slug of Object.keys(g.topics)) words.add(slug)
  }

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const bad = []
  for (const w of words) {
    if (!w) continue
    const quoted = new RegExp(`(['"\`])${esc(w)}\\1`)
    for (const f of [...srcCode, ...e2eFiles]) {
      if (quoted.test(read(f))) bad.push(`${rel(f)} (quoted "${w}")`)
    }
  }
  for (const y of years) {
    const bare = new RegExp(`\\b${esc(y)}\\b`)
    for (const f of srcCode) {
      if (bare.test(read(f))) bad.push(`${rel(f)} (bare year ${y})`)
    }
  }
  assert.deepEqual(bad, [], `bank-specific literals: ${bad.join('; ')} - read them from public/data at runtime`)
})
