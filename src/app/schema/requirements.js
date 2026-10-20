import { toDisciplineKey } from './disciplines.js'

/**
 * Amalgam requirements are encoded in the power's own name in Blood Oracle,
 * e.g. "Animal Messenger (Auspex 1)". They can be checked without the rules
 * database, unlike power prerequisites, which need it.
 */
export function parseAmalgam(rawName) {
  // The level comes as a digit in power names ("Auspex 2") and as dots in the
  // reference ("Auspex ●●"). Both count.
  const matches = [...String(rawName ?? '').matchAll(/\(([A-Za-z][A-Za-z\s'’-]+?)\s+(\d|●+)\)/g)]
  return matches.map((match) => ({
    discipline: match[1].trim(),
    level: /\d/.test(match[2]) ? parseInt(match[2], 10) : match[2].length
  }))
}

/**
 * Rituals and ceremonies are pseudo-disciplines in wod5e with no rating of
 * their own: a ritual is bounded by Blood Sorcery, a ceremony by Oblivion.
 */
const RATED_BY = { rituals: 'sorcery', ceremonies: 'oblivion' }

export function ratingKeyFor(disciplineKey) {
  return RATED_BY[disciplineKey] ?? disciplineKey
}

export function disciplineRating(actor, disciplineKey) {
  return Number(actor.system.disciplines?.[ratingKeyFor(disciplineKey)]?.value) || 0
}

/**
 * Why a reference entry is out of reach for this character, or [] when it is
 * not. Used to grey entries out in the power picker; nothing is blocked.
 */
export function entryShortfalls(actor, disciplineKey, entry) {
  const reasons = []
  const level = Number(entry.level) || 0
  const rating = disciplineRating(actor, disciplineKey)
  if (level && level > rating) reasons.push(`needs level ${level}, has ${rating}`)

  if (entry.amalgam && !/^(no|none|n\/a|—)$/i.test(String(entry.amalgam).trim())) {
    const check = checkAmalgam(actor, entry.amalgam)
    if (!check.ok) reasons.push(`needs ${describeMissing(check.missing)}`)
  }
  return reasons
}

/**
 * Check an amalgam string like "Auspex 1" (as stored in flags) or a raw power
 * name against what the actor actually has.
 *
 * Returns the requirements that are not met, so the caller can both grey out
 * the entry and explain why.
 */
export function checkAmalgam(actor, requirement) {
  const requirements =
    typeof requirement === 'string' && /\(.*\)/.test(requirement)
      ? parseAmalgam(requirement)
      : parseAmalgam(`(${requirement ?? ''})`)

  const missing = []

  for (const requirementEntry of requirements) {
    const key = toDisciplineKey(requirementEntry.discipline)
    const has = key ? Number(actor.system.disciplines?.[key]?.value) || 0 : 0
    if (has < requirementEntry.level) {
      missing.push({ ...requirementEntry, has })
    }
  }

  return { ok: missing.length === 0, missing }
}

/**
 * A power cannot exceed the rating of its own Discipline. Checked separately
 * from amalgams: this one needs no reference data, just the two numbers.
 */
export function checkLevel(actor, item) {
  const level = Number(item.system.level) || 0
  const rating = disciplineRating(actor, item.system.discipline)

  if (!level || level <= rating) return { ok: true, level, rating }
  return { ok: false, level, rating }
}

export function describeMissing(missing) {
  return missing
    .map((entry) => `${entry.discipline} ${entry.level} (has ${entry.has})`)
    .join(', ')
}

/* -------------------------------------------------------------------------
 * Power prerequisites
 *
 * Unlike amalgams, these are prose ("Ashes to Ashes", "Cloak of Shadows or
 * Unseen Passage"), so they can only be resolved against the rules reference.
 * Without it, a prerequisite is reported as unknown rather than unmet.
 * ---------------------------------------------------------------------- */

import { getRules } from '../rules/catalog.js'

function normaliseName(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function checkPrerequisite(actor, prerequisite) {
  const text = String(prerequisite ?? '').trim()
  if (!text || /^none$/i.test(text)) return { status: 'ok', missing: [] }

  const rules = getRules()
  if (!rules) return { status: 'unknown', missing: [] }

  // Find which catalogue powers the prerequisite text names, by looking for
  // each known power name as a whole phrase inside it.
  const haystack = ` ${normaliseName(text)} `
  const referenced = []
  const seen = new Set()

  for (const entry of rules.entries) {
    const candidate = normaliseName(entry.name)
    if (candidate.length < 4 || seen.has(candidate)) continue
    if (haystack.includes(` ${candidate} `)) {
      seen.add(candidate)
      referenced.push(entry.name)
    }
  }

  if (!referenced.length) return { status: 'unknown', missing: [] }

  const owned = new Set(
    actor.items
      .filter((item) => item.type === 'power')
      .map((item) => normaliseName(item.name))
  )

  // "or" / "either" makes the requirement a choice rather than a list.
  const anyOf = /\bor\b|either/i.test(text)
  const satisfied = anyOf
    ? referenced.some((name) => owned.has(normaliseName(name)))
    : referenced.every((name) => owned.has(normaliseName(name)))

  if (satisfied) return { status: 'ok', missing: [] }

  const missing = anyOf
    ? referenced
    : referenced.filter((name) => !owned.has(normaliseName(name)))

  return { status: 'missing', missing, anyOf }
}

export function describeMissingPowers(result) {
  return result.missing.join(result.anyOf ? ' or ' : ', ')
}
