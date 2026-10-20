import { MODULE_ID } from '../../constants.js'
import { PREDATORS } from '../rules/predators.js'
import { findAdvantage } from '../rules/catalog.js'
import { FEATURE_TYPES, buildFeatureData, readAdvantageMeta, dotsRange } from './advantages.js'
import { readSingletonName, setSingleton } from './singletons.js'
import { disciplineLabel } from './disciplines.js'

/**
 * Predator type grants, applied through a dialog and recorded in a journal.
 *
 * The journal lives in the actor's flags and lists exactly what was handed out
 * for one predator type, so a later change of predator can take back that and
 * nothing else. Anything the player bought on top with experience stays.
 *
 *   flags.blood-oracle.predatorGrants = {
 *     predator: 'Alleycat',
 *     entries: [
 *       { kind: 'specialty',  skill, text, label }
 *       { kind: 'discipline', key, delta, label }
 *       { kind: 'humanity',   delta, label }
 *       { kind: 'potency',    delta, label }
 *       { kind: 'feature',    itemId, label }          created by the grant
 *       { kind: 'raise',      itemId, delta, label }   dots added to an existing one
 *     ]
 *   }
 */

export const JOURNAL_FLAG = 'predatorGrants'

const norm = (value) => String(value ?? '').trim().toLowerCase()

/* ------------------------------------------------------------------ lookup */

export function findPredator(name) {
  const needle = norm(name)
  if (!needle) return null
  return Object.values(PREDATORS).find((entry) => norm(entry.name) === needle) ?? null
}

export function predatorTableNames() {
  return Object.values(PREDATORS).map((entry) => entry.name)
}

export function readJournal(actor) {
  const journal = actor?.getFlag(MODULE_ID, JOURNAL_FLAG)
  return journal?.predator ? journal : null
}

/** The predator type that granted this item, or null. */
export function featureOrigin(actor, itemId) {
  const journal = readJournal(actor)
  if (!journal) return null
  return journal.entries.some((entry) => entry.itemId === itemId) ? journal.predator : null
}

/** Specialty texts on a skill that came from the predator type. */
export function grantedSpecialties(actor, skill) {
  const journal = readJournal(actor)
  if (!journal) return []
  return journal.entries
    .filter((entry) => entry.kind === 'specialty' && entry.skill === skill)
    .map((entry) => entry.text)
}

/* ------------------------------------------------------------------ labels */

const DOTS = (n) => '●'.repeat(Math.max(0, Number(n) || 0))

export function skillLabel(key) {
  const list = WOD5E.Skills.getList({ disableSort: true }) ?? {}
  const entry = list[key]
  if (!entry) return key
  return entry.displayName || game.i18n.localize(entry.label ?? key)
}

/** Readable line for one resolved grant (text and dots filled in). */
export function grantLabel(grant) {
  switch (grant.kind) {
    case 'specialty':
      return `${skillLabel(grant.skill)} (${grant.text || grant.prompt || '…'})`
    case 'discipline':
      return `${disciplineLabel(grant.key)} ●`
    case 'humanity':
      return `Humanity ${grant.delta > 0 ? '+' : '−'}${Math.abs(grant.delta)}`
    case 'potency':
      return `Blood Potency ${grant.delta > 0 ? '+' : '−'}${Math.abs(grant.delta)}`
    default: {
      const name = grant.name || grant.text || grant.prompt || '…'
      const detail = grant.name ? grant.detail || grant.text : ''
      return `${name}${grant.dots ? ` ${DOTS(grant.dots)}` : ''}${detail ? ` (${detail})` : ''}`
    }
  }
}

/* ----------------------------------------------------------- restrictions */

/** Restrictions this actor runs into. Warnings only, never a block. */
export function restrictionWarnings(actor, predator) {
  const clan = norm(readSingletonName(actor, 'clan'))
  const potency = Number(actor.system?.blood?.potency) || 0

  return (predator.restrictions ?? [])
    .filter((rule) => {
      if (rule.clans) return rule.clans.some((name) => norm(name) === clan)
      if (rule.minPotency) return potency >= rule.minPotency
      return false
    })
    .map((rule) => rule.note)
}

/** Why a discipline option is outside this character's clan, or ''. */
export function clanNote(actor, grant) {
  if (grant.kind !== 'discipline' || !grant.clans?.length) return ''
  const clan = norm(readSingletonName(actor, 'clan'))
  if (clan && grant.clans.some((name) => norm(name) === clan)) return ''
  return `Only for ${grant.clans.join(', ')}`
}

/* -------------------------------------------------------------- selection */

/** A grant needs typed text when it leaves the specifics to the player. */
export function needsText(grant) {
  if (grant.kind === 'specialty') return !grant.text
  if (grant.kind === 'flaw' || grant.kind === 'merit' || grant.kind === 'background') {
    return Boolean(grant.prompt)
  }
  return false
}

/** Fill a grant in with the player's text. Unnamed features take it as name. */
function withText(grant, text) {
  if (!needsText(grant)) return grant
  const value = String(text ?? '').trim()
  if (grant.kind === 'specialty') return { ...grant, text: value }
  if (!grant.name) return { ...grant, name: value }
  return { ...grant, detail: value }
}

/**
 * Selections are indexed by block:
 *   choose → { option, text }
 *   spread → { alloc: [n, …], texts: [s, …] }
 */
export function emptySelections(predator) {
  return predator.blocks.map((block) => {
    if (block.type === 'choose') return { option: null, text: '' }
    if (block.type === 'spread') {
      return { alloc: block.targets.map(() => 0), texts: block.targets.map(() => '') }
    }
    return null
  })
}

export function blockComplete(block, selection) {
  if (block.type === 'fixed') return true

  if (block.type === 'choose') {
    if (selection?.option == null) return false
    const grant = block.options[selection.option]
    return !needsText(grant) || Boolean(String(selection.text ?? '').trim())
  }

  if (block.type === 'spread') {
    const total = (selection?.alloc ?? []).reduce((sum, n) => sum + n, 0)
    if (total !== block.dots) return false
    return block.targets.every(
      (target, i) =>
        !(selection.alloc[i] > 0 && needsText(target)) || Boolean(String(selection.texts[i] ?? '').trim())
    )
  }

  return false
}

export function selectionsComplete(predator, selections) {
  return predator.blocks.every((block, i) => blockComplete(block, selections[i]))
}

/** Turn blocks plus selections into concrete grants, merging repeats. */
export function resolveGrants(predator, selections) {
  const grants = []

  predator.blocks.forEach((block, i) => {
    const selection = selections[i]
    if (block.type === 'fixed') grants.push(block.grant)
    if (block.type === 'choose') {
      grants.push(withText(block.options[selection.option], selection.text))
    }
    if (block.type === 'spread') {
      block.targets.forEach((target, t) => {
        const dots = selection.alloc[t]
        if (dots > 0) grants.push({ ...withText(target, selection.texts[t]), dots })
      })
    }
  })

  // Trapdoor's second Haven dot joins the first rather than becoming a second
  // Haven: features with the same kind, name and detail add their dots.
  const merged = []
  for (const grant of grants) {
    const isFeature = ['background', 'merit', 'flaw'].includes(grant.kind)
    const same = isFeature
      ? merged.find(
          (g) => g.kind === grant.kind && norm(g.name) === norm(grant.name) && norm(g.detail) === norm(grant.detail)
        )
      : null
    if (same) same.dots += grant.dots
    else merged.push({ ...grant })
  }
  return merged
}

/* ------------------------------------------------------------------- apply */

const FEATURE_TYPE_FOR = {
  background: FEATURE_TYPES.background,
  merit: FEATURE_TYPES.merit,
  flaw: FEATURE_TYPES.flaw
}

function findFeature(actor, grant) {
  const featuretype = FEATURE_TYPE_FOR[grant.kind]
  return (
    actor.items.find(
      (item) =>
        item.type === 'feature' &&
        (item.system.featuretype || 'background') === featuretype &&
        norm(item.name) === norm(grant.name) &&
        norm(readAdvantageMeta(item).details) === norm(grant.detail)
    ) ?? null
  )
}

/**
 * A predator may grant a rating the catalogue would not let you buy — Enemy ●,
 * Allies ●, Prey Exclusion ●●. The stored range widens to hold it, and the
 * book's own rating is kept beside it for the detail panel.
 */
function featureData(grant, predatorName) {
  const kindForCatalog = grant.kind === 'flaw' ? 'flaw' : 'merit'
  const entry = findAdvantage(grant.name, kindForCatalog)
  const bookDots = entry?.dots ?? ''
  const range = bookDots ? dotsRange(bookDots) : null

  let dots = bookDots
  if (range && (grant.dots < range.min || grant.dots > range.max)) {
    const low = Math.min(range.min, grant.dots)
    const high = range.open ? null : Math.max(range.max, grant.dots)
    dots = range.fixed ? String(grant.dots) : high ? `${low}-${high}` : `${low}+`
  }

  return buildFeatureData({
    name: grant.name,
    featuretype: FEATURE_TYPE_FOR[grant.kind],
    points: grant.dots,
    description: entry?.description ?? '',
    meta: {
      group: entry?.group ?? '',
      dots: dots || String(grant.dots),
      ...(bookDots && dots !== bookDots ? { bookDots } : {}),
      hasDetails: Boolean(entry?.hasDetails || grant.detail),
      detailsPlaceholder: entry?.detailsPlaceholder ?? '',
      details: grant.detail ?? '',
      predator: predatorName
    }
  })
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value))

/**
 * Apply resolved grants and write the journal. Specialties and merits the
 * character already has are not duplicated; background dots stack.
 */
export async function applyGrants(actor, predator, grants) {
  const update = {}
  const entries = []
  const toCreate = []
  const createdLabels = []

  const bonusesBySkill = {}
  const bonusesOf = (skill) => {
    if (!bonusesBySkill[skill]) {
      bonusesBySkill[skill] = foundry.utils.deepClone(actor.system.skills?.[skill]?.bonuses ?? [])
    }
    return bonusesBySkill[skill]
  }

  for (const grant of grants) {
    const label = grantLabel(grant)

    if (grant.kind === 'specialty') {
      const bonuses = bonusesOf(grant.skill)
      if (bonuses.some((bonus) => norm(bonus.source) === norm(grant.text))) continue
      bonuses.push({ source: grant.text, value: 1, paths: [`skills.${grant.skill}`], displayWhenInactive: true })
      entries.push({ kind: 'specialty', skill: grant.skill, text: grant.text, label })
    }

    if (grant.kind === 'discipline') {
      const current = Number(actor.system.disciplines?.[grant.key]?.value) || 0
      const next = clamp(current + 1, 0, 5)
      if (next === current) continue
      update[`system.disciplines.${grant.key}.value`] = next
      update[`system.disciplines.${grant.key}.visible`] = true
      entries.push({ kind: 'discipline', key: grant.key, delta: next - current, label })
    }

    if (grant.kind === 'humanity') {
      const current = Number(actor.system.humanity?.value) || 0
      const next = clamp(current + grant.delta, 0, 10)
      if (next === current) continue
      update['system.humanity.value'] = next
      entries.push({ kind: 'humanity', delta: next - current, label })
    }

    if (grant.kind === 'potency') {
      const current = Number(actor.system.blood?.potency) || 0
      const next = clamp(current + grant.delta, 0, 10)
      if (next === current) continue
      update['system.blood.potency'] = next
      entries.push({ kind: 'potency', delta: next - current, label })
    }

    if (FEATURE_TYPE_FOR[grant.kind]) {
      const existing = findFeature(actor, grant)
      if (existing) {
        // Merits and flaws are not doubled. Background dots add up.
        if (grant.kind !== 'background') continue
        const current = Number(existing.system.points) || 0
        update[`__raise.${existing.id}`] = current + grant.dots
        entries.push({ kind: 'raise', itemId: existing.id, delta: grant.dots, label })
        continue
      }
      toCreate.push(featureData(grant, predator.name))
      createdLabels.push(label)
    }
  }

  for (const [skill, bonuses] of Object.entries(bonusesBySkill)) {
    update[`system.skills.${skill}.bonuses`] = bonuses
  }

  // Raises target embedded items, so they go through their own update call.
  const raises = Object.entries(update)
    .filter(([key]) => key.startsWith('__raise.'))
    .map(([key, points]) => ({ _id: key.slice('__raise.'.length), 'system.points': points }))
  for (const key of Object.keys(update)) if (key.startsWith('__raise.')) delete update[key]

  if (Object.keys(update).length) await actor.update(update)
  if (raises.length) await actor.updateEmbeddedDocuments('Item', raises)

  if (toCreate.length) {
    const created = await actor.createEmbeddedDocuments('Item', toCreate)
    created.forEach((item, i) => entries.push({ kind: 'feature', itemId: item.id, label: createdLabels[i] }))
  }

  await actor.setFlag(MODULE_ID, JOURNAL_FLAG, { predator: predator.name, entries })
  return entries
}

/* ------------------------------------------------------------------ revert */

/** Take back exactly what the journal records, then clear it. */
export async function revertGrants(actor) {
  const journal = readJournal(actor)
  if (!journal) return

  const update = {}
  const toDelete = []
  const raises = []
  const bonusesBySkill = {}

  for (const entry of journal.entries) {
    if (entry.kind === 'specialty') {
      const bonuses =
        bonusesBySkill[entry.skill] ??
        foundry.utils.deepClone(actor.system.skills?.[entry.skill]?.bonuses ?? [])
      const index = bonuses.findIndex((bonus) => norm(bonus.source) === norm(entry.text))
      if (index >= 0) bonuses.splice(index, 1)
      bonusesBySkill[entry.skill] = bonuses
    }

    if (entry.kind === 'discipline') {
      const current = Number(actor.system.disciplines?.[entry.key]?.value) || 0
      update[`system.disciplines.${entry.key}.value`] = clamp(current - entry.delta, 0, 5)
    }

    if (entry.kind === 'humanity') {
      const current = Number(actor.system.humanity?.value) || 0
      update['system.humanity.value'] = clamp(current - entry.delta, 0, 10)
    }

    if (entry.kind === 'potency') {
      const current = Number(actor.system.blood?.potency) || 0
      update['system.blood.potency'] = clamp(current - entry.delta, 0, 10)
    }

    if (entry.kind === 'feature' && actor.items.get(entry.itemId)) toDelete.push(entry.itemId)

    if (entry.kind === 'raise') {
      const item = actor.items.get(entry.itemId)
      if (item) {
        raises.push({ _id: item.id, 'system.points': Math.max(0, (Number(item.system.points) || 0) - entry.delta) })
      }
    }
  }

  for (const [skill, bonuses] of Object.entries(bonusesBySkill)) {
    update[`system.skills.${skill}.bonuses`] = bonuses
  }

  if (Object.keys(update).length) await actor.update(update)
  if (raises.length) await actor.updateEmbeddedDocuments('Item', raises)
  if (toDelete.length) await actor.deleteEmbeddedDocuments('Item', toDelete)
  await actor.unsetFlag(MODULE_ID, JOURNAL_FLAG)
}

/** Ask before taking grants back. Resolves true when there is nothing to undo. */
export async function confirmRevert(actor) {
  const journal = readJournal(actor)
  if (!journal) return true

  const escape = foundry.utils.escapeHTML
  const list = journal.entries.map((entry) => `<li>${escape(entry.label)}</li>`).join('')

  return foundry.applications.api.DialogV2.confirm({
    classes: ['blood-oracle', 'bo-dialog'],
    window: { title: 'Remove predator grants' },
    content:
      `<p>Changing the predator type takes back what <strong>${escape(journal.predator)}</strong> granted:</p>` +
      (list ? `<ul>${list}</ul>` : '<p><em>Nothing was recorded.</em></p>') +
      '<p>Anything bought on top with experience stays.</p>'
  })
}

/**
 * Change the predator type. Returns the table entry for the new one when the
 * grants dialog should open, null otherwise, and false when the player backed
 * out of removing the old grants.
 */
export async function changePredator(actor, name) {
  const journal = readJournal(actor)
  if (journal && norm(journal.predator) !== norm(name)) {
    if (!(await confirmRevert(actor))) return false
    await revertGrants(actor)
  }

  await setSingleton(actor, 'predatorType', name)

  const predator = findPredator(name)
  const alreadyApplied = journal && norm(journal.predator) === norm(name)
  return predator && !alreadyApplied ? predator : null
}
