#!/usr/bin/env node
/**
 * Extracts the Blood Oracle rules database out of the standalone app into a
 * single JSON file the module can load at runtime.
 *
 *   node tools/extract-rules.mjs path/to/blood_oracle.jsx out/blood-oracle-rules.json
 *
 * The output is deliberately kept outside this repository: it is close to
 * verbatim rulebook text and must not be distributed.
 */

import { readFileSync, writeFileSync } from 'node:fs'

const [, , inputPath, outputPath = 'blood-oracle-rules.json'] = process.argv

if (!inputPath) {
  console.error('Usage: node tools/extract-rules.mjs <blood_oracle.jsx> [out.json]')
  process.exit(1)
}

const source = readFileSync(inputPath, 'utf8')

/** Pull a top-level `const NAME = <literal>;` out of the source and evaluate it. */
function readLiteral(name) {
  const start = source.indexOf(`const ${name} = `)
  if (start < 0) throw new Error(`Could not find ${name} in the source file.`)

  const from = start + `const ${name} = `.length
  const opener = source[from]
  const closer = opener === '{' ? '}' : ']'

  let depth = 0
  let inString = null
  let escaped = false

  for (let i = from; i < source.length; i++) {
    const char = source[i]

    if (escaped) {
      escaped = false
      continue
    }
    if (inString) {
      if (char === '\\') escaped = true
      else if (char === inString) inString = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      inString = char
      continue
    }
    if (char === opener) depth++
    else if (char === closer) {
      depth--
      if (depth === 0) {
        const literal = source.slice(from, i + 1)
        // The literals are plain data, but may use single quotes and trailing
        // commas, so they are evaluated rather than JSON.parse'd.
        return new Function(`return (${literal});`)()
      }
    }
  }

  throw new Error(`Unterminated literal for ${name}.`)
}

const FULL_RULES = readLiteral('FULL_RULES')
const POWERS = readLiteral('POWERS')

// Clan, Humanity and Predator tables live in the same reference for the same
// reason the powers do: they are rulebook text and must not be distributed.
const CLANS = readLiteral('CLANS')
const CLAN_BANES = readLiteral('CLAN_BANES')
const CLAN_VARIANT_BANES = readLiteral('CLAN_VARIANT_BANES')
const NO_BANE_TEXT = readLiteral('NO_BANE_TEXT')
const CLAN_COMPULSIONS = readLiteral('CLAN_COMPULSIONS')
const NO_COMPULSION_TEXT = readLiteral('NO_COMPULSION_TEXT')
const HUMANITY_FLAWS = readLiteral('HUMANITY_FLAWS')
const PREDATOR_TYPES = readLiteral('PREDATOR_TYPES')
const PREDATOR_DESCRIPTIONS = readLiteral('PREDATOR_DESCRIPTIONS')
const PREDATOR_GRANTS = readLiteral('PREDATOR_GRANTS')
const BP_RANGE_BY_GEN = readLiteral('BP_RANGE_BY_GEN')
const MERITS_CATALOG = readLiteral('MERITS_CATALOG')
const FLAWS_CATALOG = readLiteral('FLAWS_CATALOG')
const RESONANCES = readLiteral('RESONANCES')
const TEMPERAMENTS = readLiteral('TEMPERAMENTS')

/** "Animal Messenger (Auspex 1)" -> { name, amalgam } */
function splitAmalgam(rawName) {
  const match = /^(.*?)\s*\(([A-Za-z' -]+\s+\d)\)\s*$/.exec(String(rawName ?? ''))
  if (!match) return { name: String(rawName ?? '').trim(), amalgam: '' }
  return { name: match[1].trim(), amalgam: match[2].trim() }
}

const NAME_TO_KEY = {
  animalism: 'animalism',
  auspex: 'auspex',
  celerity: 'celerity',
  dominate: 'dominate',
  fortitude: 'fortitude',
  obfuscate: 'obfuscate',
  potence: 'potence',
  presence: 'presence',
  protean: 'protean',
  oblivion: 'oblivion',
  'blood sorcery': 'sorcery',
  'thin-blood alchemy': 'alchemy',
  'thin blood alchemy': 'alchemy'
}

function toKey(displayName) {
  return NAME_TO_KEY[String(displayName ?? '').trim().toLowerCase()] ?? null
}

const entries = []
const unmapped = new Set()

// Powers: the discipline and level come from the POWERS index, the rules text
// from FULL_RULES, keyed by the app's display name.
for (const [disciplineName, byLevel] of Object.entries(POWERS)) {
  const key = toKey(disciplineName)
  if (!key) {
    unmapped.add(disciplineName)
    continue
  }

  for (const [level, names] of Object.entries(byLevel)) {
    for (const rawName of names) {
      const { name, amalgam } = splitAmalgam(rawName)
      const rules = FULL_RULES.powers?.[rawName] ?? {}

      entries.push({
        kind: 'power',
        discipline: key,
        level: Number(level),
        name,
        originalName: rawName,
        amalgam: amalgam || rules.amalgam || '',
        effect: rules.effect ?? '',
        cost: rules.cost ?? '',
        dicePool: rules.dicePool ?? '',
        opposingPool: rules.opposingPool ?? '',
        prerequisite: rules.prerequisite ?? '',
        duration: rules.duration ?? '',
        system: rules.system ?? '',
        ingredients: rules.ingredients ?? '',
        example: rules.example ?? '',
        special: rules.special ?? '',
        source: rules.source ?? ''
      })
    }
  }
}

// Rituals and ceremonies map onto the system's two pseudo-disciplines.
for (const [collection, discipline] of [
  ['rituals', 'rituals'],
  ['ceremonies', 'ceremonies']
]) {
  for (const [name, rules] of Object.entries(FULL_RULES[collection] ?? {})) {
    entries.push({
      kind: rules.kind ?? discipline,
      discipline,
      level: Number(rules.level) || 0,
      name,
      originalName: name,
      amalgam: '',
      effect: rules.effect ?? '',
      cost: rules.cost ?? '',
      dicePool: rules.dicePool ?? '',
      opposingPool: rules.opposingPool ?? '',
      prerequisite: rules.prerequisite ?? '',
      duration: rules.duration ?? '',
      system: rules.system ?? '',
      process: rules.process ?? '',
      ingredients: rules.ingredients ?? '',
      example: rules.example ?? '',
      special: rules.special ?? '',
      source: rules.source ?? ''
    })
  }
}

// Discipline overviews, shown on the discipline detail panel.
const disciplines = {}
for (const [name, rules] of Object.entries(FULL_RULES.disciplines ?? {})) {
  const key = toKey(name)
  if (!key) {
    unmapped.add(name)
    continue
  }
  disciplines[key] = {
    name,
    description: rules.description ?? '',
    type: rules.type ?? '',
    masqueradeThreat: rules.masqueradeThreat ?? '',
    resonance: rules.resonance ?? '',
    characteristics: rules.characteristics ?? '',
    extraSections: rules.extraSections ?? []
  }
}

// Clans, keyed by their display name, with both bane readings and the
// compulsion. Clans without a curse carry explanatory text instead.
const clans = {}
for (const name of CLANS) {
  clans[name] = {
    name,
    bane: CLAN_BANES[name] ?? '',
    variantBane: CLAN_VARIANT_BANES[name] ?? '',
    noBane: NO_BANE_TEXT[name] ?? '',
    compulsion: CLAN_COMPULSIONS[name] ?? '',
    noCompulsion: NO_COMPULSION_TEXT[name] ?? ''
  }
}

const predators = {}
for (const name of PREDATOR_TYPES) {
  const grants = PREDATOR_GRANTS[name] ?? {}
  predators[name] = {
    name,
    summary: PREDATOR_DESCRIPTIONS[name] ?? '',
    description: grants.description ?? '',
    huntingPool: grants.huntingPool ?? '',
    specialty: grants.specialty ?? '',
    discipline: grants.discipline ?? '',
    humanity: grants.humanity ?? '',
    backgrounds: grants.backgrounds ?? '',
    merits: grants.merits ?? [],
    flaws: grants.flaws ?? [],
    restrictions: grants.restrictions ?? '',
    source: grants.source ?? ''
  }
}

// Merits and flaws are grouped by category in the app. Flattened here with the
// group carried on each entry, since the sheet filters rather than nests.
function flattenAdvantages(catalog, kind) {
  const flat = []
  for (const [group, items] of Object.entries(catalog)) {
    for (const item of items) {
      flat.push({
        kind,
        group,
        name: item.name,
        // Dots are free text in the source: "2", "1-2", "1 per language".
        dots: String(item.dots ?? ''),
        description: item.description ?? '',
        hasDetails: Boolean(item.hasDetails),
        detailsPlaceholder: item.detailsPlaceholder ?? ''
      })
    }
  }
  return flat
}

const advantages = [
  ...flattenAdvantages(MERITS_CATALOG, 'merit'),
  ...flattenAdvantages(FLAWS_CATALOG, 'flaw')
]

const output = {
  format: 'blood-oracle-rules',
  version: 3,
  generated: new Date().toISOString(),
  disciplines,
  entries,
  clans,
  predators,
  advantages,
  humanityFlaws: HUMANITY_FLAWS,
  bloodPotencyByGeneration: BP_RANGE_BY_GEN,
  resonances: RESONANCES,
  temperaments: TEMPERAMENTS
}

writeFileSync(outputPath, JSON.stringify(output))

const withText = entries.filter((entry) => entry.effect).length
console.log(`Wrote ${outputPath}`)
console.log(`  ${entries.length} entries (${withText} with rules text)`)
console.log(`  ${Object.keys(disciplines).length} discipline overviews`)
console.log(`  ${Object.keys(clans).length} clans, ${Object.keys(predators).length} predator types`)
console.log(`  ${advantages.filter((a) => a.kind === 'merit').length} merits, ${advantages.filter((a) => a.kind === 'flaw').length} flaws`)
if (unmapped.size) {
  console.log(`  unmapped discipline names: ${[...unmapped].join(', ')}`)
}
