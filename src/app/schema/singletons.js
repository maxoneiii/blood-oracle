import { MODULE_ID } from '../../constants.js'

/**
 * Clan, predator type and resonance are single-instance Item documents in
 * wod5e. The sheet treats them as fields: choosing one replaces whatever was
 * there, so an actor never ends up with two clans.
 */

const SINGLETON_TYPES = ['clan', 'predatorType', 'resonance']

export function readSingleton(actor, type) {
  return actor.items.find((item) => item.type === type) ?? null
}

export function readSingletonName(actor, type) {
  return readSingleton(actor, type)?.name ?? ''
}

/**
 * Set (or clear) one of the singleton items. Extra copies are removed as well,
 * so a sheet that inherited duplicates from elsewhere settles to one.
 */
export async function setSingleton(actor, type, name, extra = {}) {
  if (!SINGLETON_TYPES.includes(type)) throw new Error(`Not a singleton item type: ${type}`)

  const existing = actor.items.filter((item) => item.type === type)
  const trimmed = String(name ?? '').trim()

  if (!trimmed) {
    if (existing.length) {
      await actor.deleteEmbeddedDocuments('Item', existing.map((item) => item.id))
    }
    return null
  }

  // Keep the first, drop any duplicates, then update in place so anything the
  // user added to the item by hand survives a rename.
  const [keep, ...duplicates] = existing
  if (duplicates.length) {
    await actor.deleteEmbeddedDocuments('Item', duplicates.map((item) => item.id))
  }

  if (keep) {
    await keep.update({ name: trimmed, ...extra })
    return keep
  }

  const [created] = await actor.createEmbeddedDocuments('Item', [
    { name: trimmed, type, ...extra }
  ])
  return created
}

/**
 * Resonance carries a temperament as well as a humour. wod5e has no field for
 * it, so it lives in our flags and the description keeps a readable copy for
 * the native sheet.
 */
export function readTemperament(actor) {
  const item = readSingleton(actor, 'resonance')
  return item?.getFlag(MODULE_ID, 'temperament') ?? ''
}

export async function setResonance(actor, humour, temperament) {
  if (!humour) return setSingleton(actor, 'resonance', '')

  const item = await setSingleton(actor, 'resonance', humour, {
    system: {
      description: temperament ? `${humour} — ${temperament}` : humour
    }
  })

  if (item) await item.setFlag(MODULE_ID, 'temperament', temperament ?? '')
  return item
}
