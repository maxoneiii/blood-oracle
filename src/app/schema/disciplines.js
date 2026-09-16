import { MODULE_ID } from '../../constants.js'

/**
 * Everything that translates between Blood Oracle's shapes and wod5e's schema
 * lives here, so the mapping can be reviewed and corrected in one place rather
 * than being spread across the tabs that consume it.
 */

/** wod5e's fourteen discipline keys, including the two pseudo-disciplines. */
export const DISCIPLINE_KEYS = [
  'animalism',
  'auspex',
  'celerity',
  'dominate',
  'fortitude',
  'obfuscate',
  'potence',
  'presence',
  'protean',
  'sorcery',
  'oblivion',
  'alchemy',
  'rituals',
  'ceremonies'
]

/** Blood Oracle stores display names; wod5e keys off lowercase identifiers. */
const NAME_TO_KEY = {
  'blood sorcery': 'sorcery',
  sorcery: 'sorcery',
  'thin-blood alchemy': 'alchemy',
  'thin blood alchemy': 'alchemy',
  alchemy: 'alchemy',
  'blood sorcery rituals': 'rituals',
  ritual: 'rituals',
  rituals: 'rituals',
  'oblivion ceremonies': 'ceremonies',
  ceremony: 'ceremonies',
  ceremonies: 'ceremonies'
}

/**
 * Resolve a Blood Oracle discipline name to a wod5e key. Returns null for
 * homebrew disciplines, which have no home in the system and stay in flags.
 */
export function toDisciplineKey(name) {
  if (!name) return null
  const normalised = String(name).trim().toLowerCase()
  if (NAME_TO_KEY[normalised]) return NAME_TO_KEY[normalised]
  if (DISCIPLINE_KEYS.includes(normalised)) return normalised
  return null
}

export function disciplineLabel(key) {
  const list = WOD5E.Disciplines.getList({ disableSort: true }) ?? {}
  const entry = list[key]
  if (!entry) return key
  return entry.displayName || game.i18n.localize(entry.label ?? key)
}

/**
 * Blood Oracle encodes an amalgam requirement in the power's own name, e.g.
 * "Animal Messenger (Auspex 1)". We strip it so the item name matches the book
 * and chat cards read cleanly, and keep the requirement alongside the rules.
 */
export function splitAmalgam(rawName) {
  const match = /^(.*?)\s*\(([A-Za-z' -]+\s+\d)\)\s*$/.exec(String(rawName ?? ''))
  if (!match) return { name: String(rawName ?? '').trim(), amalgam: '' }
  return { name: match[1].trim(), amalgam: match[2].trim() }
}

/** "Blood Sigils, page 59" -> { book: 'Blood Sigils', page: '59' } */
export function splitSource(raw) {
  if (!raw) return { book: '', page: '' }
  const match = /^(.*?),\s*(?:page|pg\.?|p\.?)\s*([\d–-]+)\s*$/i.exec(String(raw).trim())
  if (!match) return { book: String(raw).trim(), page: '' }
  return { book: match[1].trim(), page: match[2].trim() }
}

/**
 * Rouse cost is free text in Blood Oracle but a number in wod5e. Pull out a
 * count where the wording allows, and keep the full text in flags either way.
 */
const WORD_NUMBERS = { no: 0, zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5 }

export function parseRouseCost(raw) {
  if (!raw) return 0
  const text = String(raw).toLowerCase()
  if (!text.includes('rouse')) return 0

  const digit = /(\d+)\s+rouse/.exec(text)
  if (digit) return Number(digit[1])

  for (const [word, value] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\s+rouse`).test(text)) return value
  }
  return 1
}

/**
 * Turn "Intelligence + Blood Sorcery" into wod5e's dicepool object, which is a
 * map of arbitrary keys to `{ path }` entries pointing at actor data.
 * Unrecognised terms are skipped rather than guessed at.
 */
export function parseDicePool(raw) {
  if (!raw) return {}

  const attributes = WOD5E.Attributes.getList({ disableSort: true }) ?? {}
  const skills = WOD5E.Skills.getList({ disableSort: true }) ?? {}

  const lookup = (term) => {
    const key = term.trim().toLowerCase().replace(/\s+/g, '')
    if (attributes[key]) return `attributes.${key}`
    if (skills[key]) return `skills.${key}`
    const disciplineKey = toDisciplineKey(term)
    if (disciplineKey) return `disciplines.${disciplineKey}`
    return null
  }

  const dicepool = {}
  let index = 0
  for (const term of String(raw).split('+')) {
    const path = lookup(term)
    if (path) dicepool[index++] = { path }
  }
  return dicepool
}

/**
 * Fields from the Blood Oracle rules database that wod5e has nowhere to put.
 * They are the reason the reference is worth porting, so they travel with the
 * item in module flags.
 */
export const RULE_FLAG_FIELDS = [
  'amalgam',
  'prerequisite',
  'cost',
  'dicePool',
  'opposingPool',
  'duration',
  'system',
  'process',
  'ingredients',
  'example',
  'special'
]

/**
 * Build the data for a `power` item from a Blood Oracle power name plus its
 * entry in the rules database.
 *
 * `effect` is duplicated into the system's own description field so the power
 * still reads sensibly on the native wod5e sheet, while the fuller rules text
 * stays in our flags.
 */
export function buildPowerItemData({ rawName, disciplineKey, level, rules = {} }) {
  const { name, amalgam } = splitAmalgam(rawName)
  const source = splitSource(rules.source)

  const flagged = {}
  for (const field of RULE_FLAG_FIELDS) {
    if (rules[field]) flagged[field] = rules[field]
  }
  if (amalgam && !flagged.amalgam) flagged.amalgam = amalgam

  return {
    name,
    type: 'power',
    system: {
      discipline: disciplineKey,
      level: Number(level) || Number(rules.level) || 0,
      cost: parseRouseCost(rules.cost),
      description: rules.effect ?? '',
      dicepool: parseDicePool(rules.dicePool),
      source
    },
    flags: {
      [MODULE_ID]: {
        rules: flagged,
        // Keeps the original label so a re-import can match what it created.
        originalName: String(rawName ?? '')
      }
    }
  }
}

/** Read the rules block back off an item. */
export function readPowerRules(item) {
  return item.getFlag(MODULE_ID, 'rules') ?? {}
}
