import { MODULE_ID } from '../../constants.js'

/**
 * Inventory maps onto wod5e's `armor`, `weapon` and `gear` item types.
 *
 * The system has no notion of an item being equipped, so that state lives in
 * module flags. It matters mechanically: only equipped weapons contribute
 * damage dice, and only equipped heavy armour costs Dexterity.
 */

/**
 * The system has three item types, but "gear" covers two different things at
 * the table: what a character has on them right now, and what they own but keep
 * elsewhere — a car, a safe deposit box, the contents of a haven.
 *
 * Both are `gear` items; the distinction is a module flag, since the system has
 * nowhere to record it.
 */
export const GEAR_PLACES = { carried: 'carried', property: 'property' }

export const SECTIONS = [
  { id: 'armor', label: 'Armour', placeholder: 'Type, protection, drawbacks…' },
  { id: 'weapon', label: 'Weapons', placeholder: 'Damage, range, concealment…' },
  {
    id: 'gear',
    place: GEAR_PLACES.carried,
    label: 'Carried',
    placeholder: 'What is on them right now — tools, phone, a stake…'
  },
  {
    id: 'gear',
    place: GEAR_PLACES.property,
    label: 'Property',
    placeholder: 'Owned but kept elsewhere — vehicles, havens, valuables…'
  }
]

export function gearPlace(item) {
  // Gear written before this flag existed was carried, which is the safer read.
  return item.getFlag(MODULE_ID, 'place') ?? GEAR_PLACES.carried
}

export async function setGearPlace(item, place) {
  await item.setFlag(MODULE_ID, 'place', place)
}

/** Armour ratings from the V5 Player's Guide table. */
export const ARMOR_VALUES = [
  { id: 'soft', label: '2 (0 against bullets) — reinforced clothing, leather', dice: 2, vsBullets: 0 },
  { id: '2', label: '2 — ballistic cloth (aramid)', dice: 2 },
  { id: '4', label: '4 — kevlar vest / body armour', dice: 4 },
  { id: '6', label: '6 — full tactical loadout (−1 Dexterity pool)', dice: 6, dexPenalty: 1 }
]

export const ARMOR_BY_ID = Object.fromEntries(ARMOR_VALUES.map((entry) => [entry.id, entry]))

export const WEAPON_TYPES = ['melee', 'ranged']

export function itemsOfSection(actor, section) {
  return actor.items
    .filter((item) => item.type === section.id)
    .filter((item) => !section.place || gearPlace(item) === section.place)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function isEquipped(item) {
  return item.getFlag(MODULE_ID, 'equipped') === true
}

export async function setEquipped(item, equipped) {
  await item.setFlag(MODULE_ID, 'equipped', Boolean(equipped))
}

/** The armour table entry chosen for this item, if any. */
export function armorRating(item) {
  const id = item.getFlag(MODULE_ID, 'armorRating')
  return id ? ARMOR_BY_ID[id] ?? null : null
}

export async function setArmorRating(item, id) {
  const entry = ARMOR_BY_ID[id]
  await item.setFlag(MODULE_ID, 'armorRating', id ?? '')
  // Mirror the numeric value into the system's own field so the native sheet
  // and any macros see the same rating.
  await item.update({ 'system.armorvalue': entry?.dice ?? 0 })
}

export function buildItemData(section, name = '') {
  const base = {
    name: String(name).trim() || `New ${section.label.toLowerCase()} entry`,
    type: section.id,
    system: { quantity: 1, description: '' }
  }

  if (section.id === 'weapon') {
    base.system.weaponType = 'melee'
    base.system.weaponvalue = 0
  }
  if (section.id === 'armor') {
    base.system.armorvalue = 0
  }
  if (section.place) {
    base.flags = { [MODULE_ID]: { place: section.place } }
  }

  return base
}

/* ------------------------------------------------------- roll contributions */

/**
 * Highest damage bonus among equipped weapons of a type. V5 weapon damage is a
 * flat bonus to successes, not extra dice, which is why it is reported apart
 * from the pool.
 */
export function equippedWeaponBonus(actor, weaponType) {
  const bonuses = actor.items
    .filter((item) => item.type === 'weapon' && item.system.weaponType === weaponType)
    .filter(isEquipped)
    .map((item) => Number(item.system.weaponvalue) || 0)

  return bonuses.length ? Math.max(...bonuses) : 0
}

export function ownedWeaponCount(actor, weaponType) {
  return actor.items.filter(
    (item) => item.type === 'weapon' && item.system.weaponType === weaponType
  ).length
}

export function equippedWeaponCount(actor, weaponType) {
  return actor.items.filter(
    (item) => item.type === 'weapon' && item.system.weaponType === weaponType && isEquipped(item)
  ).length
}

/** Equipped armour heavy enough to cost Dexterity, if the character wears any. */
export function equippedHeavyArmor(actor) {
  return (
    actor.items
      .filter((item) => item.type === 'armor' && isEquipped(item))
      .find((item) => armorRating(item)?.dexPenalty) ?? null
  )
}
