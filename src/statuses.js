import { MODULE_ID } from './constants.js'

/**
 * Token statuses for the states the table needs to read at a glance.
 *
 * Health and willpower bars need nothing from us: wod5e already declares
 * `primaryTokenAttribute` and `secondaryTokenAttribute` in its manifest and
 * keeps the derived values current. Statuses are the gap.
 *
 * Icons ship with the module rather than referencing core paths, so nothing
 * breaks if Foundry reorganises its own icon set.
 */

const ICONS = `modules/${MODULE_ID}/icons`

export const STATUSES = [
  { id: `${MODULE_ID}.hunger1`, name: 'Hunger 1', img: `${ICONS}/hunger.svg` },
  { id: `${MODULE_ID}.hunger2`, name: 'Hunger 2', img: `${ICONS}/hunger.svg` },
  { id: `${MODULE_ID}.hunger3`, name: 'Hunger 3', img: `${ICONS}/hunger.svg` },
  { id: `${MODULE_ID}.hunger4`, name: 'Hunger 4', img: `${ICONS}/hunger.svg` },
  { id: `${MODULE_ID}.hunger5`, name: 'Ravenous (Hunger 5)', img: `${ICONS}/ravenous.svg` },
  { id: `${MODULE_ID}.impairedPhysical`, name: 'Impaired (physical)', img: `${ICONS}/impaired.svg` },
  { id: `${MODULE_ID}.impairedMental`, name: 'Impaired (social/mental)', img: `${ICONS}/impaired.svg` },
  { id: `${MODULE_ID}.frenzy`, name: 'Frenzy', img: `${ICONS}/frenzy.svg` }
]

export function registerStatuses() {
  for (const status of STATUSES) {
    if (!CONFIG.statusEffects.some((existing) => existing.id === status.id)) {
      CONFIG.statusEffects.push(status)
    }
  }
}

function isImpaired(track) {
  const max = track?.max ?? 0
  return max > 0 && (track.superficial ?? 0) + (track.aggravated ?? 0) >= max
}

/** Which of our statuses should be active for this actor right now. */
function desiredStatuses(actor) {
  const active = new Set()

  if (actor.system?.gamesystem === 'vampire' && actor.type !== 'ghoul') {
    const hunger = Math.max(0, Math.min(5, Number(actor.system?.hunger?.value) || 0))
    if (hunger > 0) active.add(`${MODULE_ID}.hunger${hunger}`)
  }

  if (isImpaired(actor.system?.health)) active.add(`${MODULE_ID}.impairedPhysical`)
  if (isImpaired(actor.system?.willpower)) active.add(`${MODULE_ID}.impairedMental`)

  return active
}

/**
 * Bring the actor's statuses in line with its data.
 *
 * Frenzy is deliberately left alone: it is set by play, not derived from a
 * number, so toggling it is the user's business.
 */
export async function syncStatuses(actor) {
  if (!actor?.isOwner) return
  if (actor.type !== 'vampire' && actor.type !== 'ghoul') return

  // Guard rather than throw if the core status API ever moves.
  if (typeof actor.toggleStatusEffect !== 'function' || !(actor.statuses instanceof Set)) {
    console.warn('Blood Oracle | Status effect API not available; skipping token statuses.')
    return
  }

  const wanted = desiredStatuses(actor)
  const managed = STATUSES.map((status) => status.id).filter(
    (id) => !id.endsWith('.frenzy')
  )

  for (const id of managed) {
    const on = actor.statuses?.has(id) ?? false
    const shouldBeOn = wanted.has(id)
    if (on !== shouldBeOn) {
      await actor.toggleStatusEffect(id, { active: shouldBeOn })
    }
  }
}

export function registerStatusHooks() {
  // Only react to changes that can alter a status, so ordinary edits do not
  // trigger a round of effect updates.
  Hooks.on('updateActor', (actor, changes) => {
    const touched =
      foundry.utils.hasProperty(changes, 'system.hunger') ||
      foundry.utils.hasProperty(changes, 'system.health') ||
      foundry.utils.hasProperty(changes, 'system.willpower')

    if (touched) syncStatuses(actor)
  })

  // A newly placed token inherits whatever the actor already warrants.
  Hooks.on('createToken', (token) => {
    if (token.actor) syncStatuses(token.actor)
  })
}
