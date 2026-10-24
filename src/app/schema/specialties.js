import { grantedSpecialties, readJournal } from './predator-grants.js'

/**
 * wod5e stores specialties as bonus records on the skill:
 *   { source: 'grappling', value: 1, paths: ['skills.brawl'] }
 *
 * Every record is one specialty. Edits touch one record at a time and leave
 * the others exactly as they were, so a record the predator type wrote stays
 * matchable by its journal, and anything else on the skill is not rewritten.
 */

const norm = (value) => String(value ?? '').trim().toLowerCase()

function bonusesOf(actor, skillId) {
  return actor.system.skills?.[skillId]?.bonuses ?? []
}

/**
 * The skill's specialties in stored order:
 *   [{ index, text, granted }]
 * `index` points into the skill's bonus array; `granted` is set when the
 * predator type gave it, which makes it read-only on the sheet.
 */
export function readSpecialties(actor, skillId) {
  const granted = grantedSpecialties(actor, skillId).map(norm)
  return bonusesOf(actor, skillId)
    .map((bonus, index) => ({ index, text: String(bonus?.source ?? '').trim() }))
    .filter((entry) => entry.text)
    .map((entry) => ({ ...entry, granted: granted.includes(norm(entry.text)) }))
}

/** The predator type named on granted specialties, for their tooltip. */
export function grantingPredator(actor) {
  return readJournal(actor)?.predator ?? null
}

export async function addSpecialty(actor, skillId, text) {
  const name = String(text ?? '').trim()
  if (!name) return false
  const bonuses = bonusesOf(actor, skillId)
  if (bonuses.some((bonus) => norm(bonus?.source) === norm(name))) {
    ui.notifications.info(`That specialty is already on the skill.`)
    return false
  }
  const record = { source: name, value: 1, paths: [`skills.${skillId}`], displayWhenInactive: true }
  await actor.update({ [`system.skills.${skillId}.bonuses`]: [...foundry.utils.deepClone(bonuses), record] })
  return true
}

/** Renaming to nothing removes the record. */
export async function renameSpecialty(actor, skillId, index, text) {
  const name = String(text ?? '').trim()
  if (!name) return removeSpecialty(actor, skillId, index)

  const bonuses = foundry.utils.deepClone(bonusesOf(actor, skillId))
  if (!bonuses[index] || bonuses[index].source === name) return
  if (bonuses.some((bonus, i) => i !== index && norm(bonus?.source) === norm(name))) {
    ui.notifications.info(`That specialty is already on the skill.`)
    return
  }
  bonuses[index] = { ...bonuses[index], source: name }
  await actor.update({ [`system.skills.${skillId}.bonuses`]: bonuses })
}

export async function removeSpecialty(actor, skillId, index) {
  const bonuses = foundry.utils.deepClone(bonusesOf(actor, skillId))
  if (!bonuses[index]) return
  bonuses.splice(index, 1)
  await actor.update({ [`system.skills.${skillId}.bonuses`]: bonuses })
}
