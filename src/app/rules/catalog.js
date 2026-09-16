import { MODULE_ID } from '../../constants.js'

/**
 * The rules reference is loaded at runtime from a JSON file in Foundry's Data
 * directory rather than shipped with the module.
 *
 * That is a licensing decision, not a technical one: the text is close to
 * verbatim rulebook content and must not be distributed. Foundry serves the
 * Data directory over HTTP, so players' clients fetch the same file the GM
 * installed, and replacing that one file updates everyone.
 *
 * The sheet works without it. Everything degrades to manual entry.
 */

export const CURRENT_FORMAT_VERSION = 3
export const RULES_PATH_SETTING = 'rulesPath'
export const DEFAULT_RULES_PATH = 'blood-oracle/blood-oracle-rules.json'

let cache = null
let loading = null

function normalise(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildIndex(data) {
  const entries = Array.isArray(data?.entries) ? data.entries : []

  return {
    version: data?.version ?? 0,
    generated: data?.generated ?? '',
    disciplines: data?.disciplines ?? {},
    clans: data?.clans ?? {},
    advantages: Array.isArray(data?.advantages) ? data.advantages : [],
    predators: data?.predators ?? {},
    humanityFlaws: data?.humanityFlaws ?? {},
    bloodPotencyByGeneration: data?.bloodPotencyByGeneration ?? {},
    resonances: data?.resonances ?? [],
    temperaments: data?.temperaments ?? [],
    entries,
    // Indexed under both the clean name and the original label with its
    // amalgam suffix, since imports arrive carrying the suffix.
    byNormalisedName: entries.reduce((map, entry) => {
      map.set(normalise(entry.name), entry)
      if (entry.originalName) map.set(normalise(entry.originalName), entry)
      return map
    }, new Map()),
    byDiscipline: entries.reduce((accumulator, entry) => {
      ;(accumulator[entry.discipline] ??= []).push(entry)
      return accumulator
    }, {})
  }
}

/**
 * Fetch and index the reference. Resolves to null when no file is configured
 * or the file is missing, which is a supported state rather than an error.
 */
export async function loadRules({ force = false } = {}) {
  if (cache && !force) return cache
  if (loading && !force) return loading

  const path = game.settings.get(MODULE_ID, RULES_PATH_SETTING)
  if (!path) {
    cache = null
    return null
  }

  loading = (async () => {
    try {
      const response = await fetch(foundry.utils.getRoute(path), { cache: 'no-cache' })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)

      const data = await response.json()
      if (data?.format !== 'blood-oracle-rules') {
        throw new Error('The file is not a Blood Oracle rules export.')
      }

      cache = buildIndex(data)

      // An older export is missing whole tables rather than a few fields, and
      // the symptom is empty dropdowns rather than an error, so say so plainly.
      if ((data.version ?? 0) < CURRENT_FORMAT_VERSION) {
        const message =
          `The rules reference is format version ${data.version ?? 0}, but this module expects ` +
          `${CURRENT_FORMAT_VERSION}. Some catalogues will be empty. ` +
          'Regenerate the file with tools/extract-rules.mjs and copy it over the one in Data.'
        console.warn(`Blood Oracle | ${message}`)
        if (game.user.isGM) ui.notifications.warn(message, { permanent: true })
      }

      return cache
    } catch (error) {
      console.warn(`Blood Oracle | Rules reference not loaded from "${path}":`, error.message)
      cache = null

      // Without the reference the sheet still works, but every catalogue is
      // empty — and a Storyteller who has just installed the module has no way
      // to know that is expected rather than broken.
      if (game.user.isGM) {
        ui.notifications.info(
          'Blood Oracle: no rules reference found, so clan, predator, power and merit ' +
            'catalogues will be empty. The sheet works without it — see RULES.md to add one.',
          { permanent: true }
        )
      }
      return null
    } finally {
      loading = null
    }
  })()

  return loading
}

/** Synchronous accessor for components; null until `loadRules` has resolved. */
export function getRules() {
  return cache
}

export function isLoaded() {
  return cache !== null
}

/** Entries for one discipline, ordered by level then name. */
export function entriesForDiscipline(disciplineKey) {
  const rules = getRules()
  if (!rules) return []
  return [...(rules.byDiscipline[disciplineKey] ?? [])].sort(
    (a, b) => a.level - b.level || a.name.localeCompare(b.name)
  )
}

export function findEntryByName(name) {
  return getRules()?.byNormalisedName.get(normalise(name)) ?? null
}

export function disciplineOverview(disciplineKey) {
  return getRules()?.disciplines?.[disciplineKey] ?? null
}

/** Clan entry by display name, with bane, variant bane and compulsion. */
export function clanInfo(name) {
  if (!name) return null
  const clans = getRules()?.clans ?? {}
  const key = Object.keys(clans).find(
    (candidate) => candidate.toLowerCase() === String(name).trim().toLowerCase()
  )
  return key ? clans[key] : null
}

export function predatorInfo(name) {
  if (!name) return null
  const predators = getRules()?.predators ?? {}
  const key = Object.keys(predators).find(
    (candidate) => candidate.toLowerCase() === String(name).trim().toLowerCase()
  )
  return key ? predators[key] : null
}

/** The penalties and privileges attached to a Humanity rating. */
export function humanityFlaw(value) {
  return getRules()?.humanityFlaws?.[String(value)] ?? ''
}

export function bloodPotencyRange(generation) {
  if (!generation) return null
  const table = getRules()?.bloodPotencyByGeneration ?? {}
  return table[String(generation)] ?? table[`${generation}th`] ?? null
}

export function resonanceOptions() {
  const rules = getRules()
  return {
    humours: rules?.resonances ?? [],
    temperaments: rules?.temperaments ?? []
  }
}

/**
 * Merits, flaws and backgrounds from the reference.
 * `kind` is 'merit' or 'flaw'; the Backgrounds group is treated separately by
 * callers, since the system files those under their own feature type.
 */
export function advantagesOfKind(kind) {
  const all = getRules()?.advantages ?? []
  return all.filter((entry) => entry.kind === kind)
}

export function findAdvantage(name, kind) {
  const needle = normalise(name)
  return (
    (getRules()?.advantages ?? []).find(
      (entry) => normalise(entry.name) === needle && (!kind || entry.kind === kind)
    ) ?? null
  )
}

export function searchAdvantages(query, { kind, limit = 40 } = {}) {
  const needle = normalise(query)
  const pool = advantagesOfKind(kind)
  const matches = needle
    ? pool.filter(
        (entry) => normalise(entry.name).includes(needle) || normalise(entry.group).includes(needle)
      )
    : [...pool]

  return matches
    .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
    .slice(0, limit)
}

export function clanNames() {
  return Object.keys(getRules()?.clans ?? {})
}

export function predatorNames() {
  return Object.keys(getRules()?.predators ?? {})
}

/** Simple substring search over names, used by the catalogue picker. */
export function searchEntries(query, { discipline = null, limit = 40 } = {}) {
  const rules = getRules()
  if (!rules) return []

  const needle = normalise(query)
  const pool = discipline ? rules.byDiscipline[discipline] ?? [] : rules.entries

  const matches = needle
    ? pool.filter((entry) => normalise(entry.name).includes(needle))
    : [...pool]

  return matches
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    .slice(0, limit)
}
