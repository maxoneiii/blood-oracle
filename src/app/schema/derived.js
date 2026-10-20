import { MODULE_ID } from '../../constants.js'

/**
 * Health and Willpower maximums, derived from attributes.
 *
 * wod5e stores both maximums as plain numbers edited by hand, and its own sheet
 * offers plus and minus buttons for them. That is deliberate on their side —
 * Fortitude, merits and flaws all move the maximum — but it means raising
 * Stamina does nothing to Health until someone remembers to adjust it.
 *
 * Here the core rule does the work: Health is Stamina + 3, Willpower is
 * Composure + Resolve. Everything else that moves a maximum goes into a bonus
 * the player sets by hand, which is added on top. The two together are written
 * to the system's own `max`, so tokens, the native sheet and other modules all
 * see the same number.
 */

export const BONUS_FLAG = 'trackBonus'

/** Characters whose tracks follow these rules. Story characters have their own model. */
const DERIVED_TYPES = new Set(['vampire', 'ghoul', 'mortal'])

function attribute(actor, key) {
  return Number(actor.system?.attributes?.[key]?.value) || 0
}

export function readBonus(actor) {
  const stored = actor.getFlag(MODULE_ID, BONUS_FLAG) ?? {}
  return {
    health: Number(stored.health) || 0,
    willpower: Number(stored.willpower) || 0
  }
}

export function baseMax(actor) {
  return {
    health: attribute(actor, 'stamina') + 3,
    willpower: attribute(actor, 'composure') + attribute(actor, 'resolve')
  }
}

export function derivedMax(actor) {
  const base = baseMax(actor)
  const bonus = readBonus(actor)
  return {
    // A maximum below one would leave a track with no boxes at all.
    health: Math.max(1, base.health + bonus.health),
    willpower: Math.max(1, base.willpower + bonus.willpower)
  }
}

export function usesDerivedTracks(actor) {
  return DERIVED_TYPES.has(actor?.type)
}

/**
 * Damage that no longer fits after a maximum shrinks is trimmed: superficial
 * first, since aggravated damage is the more serious and should be the last to
 * disappear from view.
 */
function fitDamage(track, max) {
  let superficial = Number(track?.superficial) || 0
  let aggravated = Number(track?.aggravated) || 0

  aggravated = Math.min(aggravated, max)
  superficial = Math.min(superficial, max - aggravated)

  return { superficial, aggravated }
}

/** The update needed to bring stored maximums in line, or null if nothing changes. */
export function trackUpdate(actor) {
  if (!usesDerivedTracks(actor)) return null

  const target = derivedMax(actor)
  const update = {}

  for (const key of ['health', 'willpower']) {
    const track = actor.system?.[key] ?? {}
    if ((Number(track.max) || 0) === target[key]) continue

    update[`system.${key}.max`] = target[key]

    const fitted = fitDamage(track, target[key])
    if (fitted.superficial !== (Number(track.superficial) || 0)) {
      update[`system.${key}.superficial`] = fitted.superficial
    }
    if (fitted.aggravated !== (Number(track.aggravated) || 0)) {
      update[`system.${key}.aggravated`] = fitted.aggravated
    }
  }

  return Object.keys(update).length ? update : null
}

export async function syncTracks(actor) {
  if (!actor?.isOwner) return
  const update = trackUpdate(actor)
  if (update) await actor.update(update)
}

export async function setBonus(actor, key, value) {
  const bonus = readBonus(actor)
  await actor.setFlag(MODULE_ID, BONUS_FLAG, { ...bonus, [key]: Number(value) || 0 })
}

/**
 * Keep maximums in step as attributes change. Only the client that made the
 * change acts on it, so several connected owners do not all write at once.
 */
export function registerTrackHooks() {
  Hooks.on('updateActor', (actor, changes, options, userId) => {
    if (userId !== game.user.id) return

    const relevant =
      foundry.utils.hasProperty(changes, 'system.attributes') ||
      foundry.utils.hasProperty(changes, `flags.${MODULE_ID}.${BONUS_FLAG}`)

    if (relevant) syncTracks(actor)
  })

  Hooks.on('createActor', (actor, options, userId) => {
    if (userId === game.user.id) syncTracks(actor)
  })
}
