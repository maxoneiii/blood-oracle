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

/**
 * Armour classes from the V5 Player's Guide table. The ids are the ones flags
 * already hold, so armour made before the dialog keeps its class. The rating
 * and its drawbacks are the book's; the examples are ours.
 */
export const ARMOR_VALUES = [
  {
    id: 'soft',
    label: 'Reinforced clothing',
    examples: 'Heavy clothing with inserts, a leather jacket',
    dice: 2,
    vsBullets: 0,
    note: '0 against bullets'
  },
  { id: '2', label: 'Ballistic cloth', examples: 'Clothing woven with aramid fibre', dice: 2 },
  { id: '4', label: 'Body armour', examples: 'A kevlar vest, a flak jacket', dice: 4 },
  {
    id: '6',
    label: 'Full tactical gear',
    examples: 'A soldier’s or SWAT officer’s full kit',
    dice: 6,
    dexPenalty: 1,
    note: '−1 die to Dexterity pools'
  }
]

export const ARMOR_BY_ID = Object.fromEntries(ARMOR_VALUES.map((entry) => [entry.id, entry]))

export const WEAPON_TYPES = ['melee', 'ranged']

/**
 * Weapon classes from the corebook's damage table, split by range. The bonus is
 * the book's; the examples are ours, there to show what each class means.
 * The class lives in module flags; range and bonus are mirrored into the
 * system's own fields, which is what rolls and other sheets read.
 */
export const WEAPON_CLASSES = [
  { id: 'improvised', range: 'melee', label: 'Improvised', bonus: 0, examples: 'A chair leg, a bottle, a wooden stake' },
  { id: 'light-blunt', range: 'melee', label: 'Light blunt', bonus: 1, examples: 'Brass knuckles, a sap' },
  { id: 'heavy-blunt', range: 'melee', label: 'Heavy blunt', bonus: 2, examples: 'A club, a crowbar, a baseball bat' },
  { id: 'light-blade', range: 'melee', label: 'Light piercing or slashing', bonus: 2, examples: 'A switchblade, a stiletto' },
  { id: 'heavy-blade', range: 'melee', label: 'Heavy blade', bonus: 3, examples: 'A sword, a fire axe' },
  { id: 'massive', range: 'melee', label: 'Massive melee', bonus: 4, examples: 'A greatsword, a length of rebar' },
  { id: 'thrown', range: 'ranged', label: 'Improvised', bonus: 0, examples: 'A thrown brick, a bottle' },
  { id: 'light-ranged', range: 'ranged', label: 'Light piercing', bonus: 2, examples: 'A crossbow, a throwing knife' },
  { id: 'low-firearm', range: 'ranged', label: 'Low-caliber firearm', bonus: 2, examples: 'A .22 pistol' },
  { id: 'medium-firearm', range: 'ranged', label: 'Medium firearm', bonus: 3, examples: 'A 9mm pistol, a hunting rifle, a shotgun at range' },
  { id: 'high-firearm', range: 'ranged', label: 'High-caliber firearm', bonus: 4, examples: 'A magnum revolver, a shotgun at close range' }
]

export const WEAPON_CLASS_BY_ID = Object.fromEntries(WEAPON_CLASSES.map((entry) => [entry.id, entry]))

/**
 * The class recorded on a weapon. Weapons made before classes existed have
 * none; if their range and bonus point at exactly one class, that one is read.
 */
export function weaponClass(item) {
  const id = item.getFlag(MODULE_ID, 'weaponClass')
  if (id && WEAPON_CLASS_BY_ID[id]) return WEAPON_CLASS_BY_ID[id]

  const range = item.system.weaponType ?? 'melee'
  const bonus = Number(item.system.weaponvalue) || 0
  const matches = WEAPON_CLASSES.filter((entry) => entry.range === range && entry.bonus === bonus)
  return matches.length === 1 ? matches[0] : null
}

/** Name, range and class in the shape both the system and the module read. */
export function weaponUpdate({ name, classId }) {
  const entry = WEAPON_CLASS_BY_ID[classId]
  return {
    name: String(name ?? '').trim(),
    'system.weaponType': entry.range,
    'system.weaponvalue': entry.bonus,
    [`flags.${MODULE_ID}.weaponClass`]: entry.id
  }
}

export function buildWeaponData({ name, classId }) {
  const entry = WEAPON_CLASS_BY_ID[classId]
  return {
    name: String(name ?? '').trim(),
    type: 'weapon',
    system: { quantity: 1, description: '', weaponType: entry.range, weaponvalue: entry.bonus },
    flags: { [MODULE_ID]: { weaponClass: entry.id } }
  }
}

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
  if (id && ARMOR_BY_ID[id]) return ARMOR_BY_ID[id]

  // Armour made without a class: if its rating points at exactly one, read it.
  const dice = Number(item.system?.armorvalue) || 0
  const matches = ARMOR_VALUES.filter((entry) => entry.dice === dice)
  return !id && matches.length === 1 ? matches[0] : null
}

/** Name and class in the shape both the system and the module read. */
export function armorUpdate({ name, classId }) {
  const entry = ARMOR_BY_ID[classId]
  return {
    name: String(name ?? '').trim(),
    'system.armorvalue': entry.dice,
    [`flags.${MODULE_ID}.armorRating`]: entry.id
  }
}

export function buildArmorData({ name, classId }) {
  const entry = ARMOR_BY_ID[classId]
  return {
    name: String(name ?? '').trim(),
    type: 'armor',
    system: { quantity: 1, description: '', armorvalue: entry.dice },
    flags: { [MODULE_ID]: { armorRating: entry.id } }
  }
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
