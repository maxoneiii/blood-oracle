import { bloodPotencyRow, readResonance } from './tables.js'
import {
  equippedWeaponBonus,
  equippedHeavyArmor,
  ownedWeaponCount,
  equippedWeaponCount,
  armorRating
} from '../schema/inventory.js'
import { readSpecialties } from '../schema/specialties.js'

/**
 * Everything that decides how many dice a roll uses, kept separate from the UI
 * so the arithmetic can be read and corrected on its own.
 *
 * Ported from the standalone app's roll modal.
 */

const PHYSICAL = ['strength', 'dexterity', 'stamina']
const SOCIAL = ['charisma', 'manipulation', 'composure']
const MENTAL = ['intelligence', 'wits', 'resolve']

export function slotValue(actor, slot) {
  if (!slot?.kind || !slot.id) return 0

  if (slot.kind === 'attribute') return Number(actor.system.attributes?.[slot.id]?.value) || 0
  if (slot.kind === 'skill') return Number(actor.system.skills?.[slot.id]?.value) || 0
  if (slot.kind === 'discipline') return Number(actor.system.disciplines?.[slot.id]?.value) || 0
  return 0
}

/**
 * The specialties a pool can use, grouped by the skills in it, each skill once:
 *   [{ skillId, skillLabel, entries: [{ key, text, granted, skillLabel }] }]
 * Skills without specialties are left out.
 */
export function specialtyChoicesFor(actor, slots) {
  const seen = new Set()
  const groups = []
  for (const slot of slots) {
    if (slot?.kind !== 'skill' || !slot.id || seen.has(slot.id)) continue
    seen.add(slot.id)
    const entries = readSpecialties(actor, slot.id).map((entry) => ({
      key: `${slot.id}::${entry.text}`,
      text: entry.text,
      granted: entry.granted,
      skillLabel: slot.label
    }))
    if (entries.length) groups.push({ skillId: slot.id, skillLabel: slot.label, entries })
  }
  return groups
}

/** A track counts as impaired once damage fills it completely. */
function isImpaired(track) {
  const max = track?.max ?? 0
  return max > 0 && (track.superficial ?? 0) + (track.aggravated ?? 0) >= max
}

/**
 * Work out the full composition of a pool, returning every contribution
 * separately so the UI can show its reasoning rather than just a number.
 */
export function composePool(actor, { slots, modifier = 0, options = {} }) {
  const parts = []

  const traitsTotal = slots.reduce((sum, slot) => sum + slotValue(actor, slot), 0)
  for (const slot of slots) {
    const value = slotValue(actor, slot)
    if (slot?.id) parts.push({ label: slot.label, value })
  }

  if (modifier) parts.push({ label: 'Modifier', value: Number(modifier) })

  const potency = Number(actor.system.blood?.potency) || 0
  const row = bloodPotencyRow(potency)

  // Blood surge: the Blood Potency table's surge value, paid for with a Rouse
  // check that the caller makes separately.
  const surge = options.bloodSurge ? row.surge : 0
  if (surge) parts.push({ label: 'Blood surge', value: surge })

  // Specialty: one die, from one specialty, whichever skill in the pool it
  // belongs to. The player picks it by key; an unknown key applies nothing.
  const specialtyChoices = specialtyChoicesFor(actor, slots)
  const chosenSpecialty = options.specialty
    ? specialtyChoices.flatMap((group) => group.entries).find((entry) => entry.key === options.specialty) ?? null
    : null
  const specialty = chosenSpecialty ? 1 : 0
  if (chosenSpecialty) {
    const name =
      specialtyChoices.length > 1 ? `${chosenSpecialty.skillLabel}: ${chosenSpecialty.text}` : chosenSpecialty.text
    parts.push({ label: `Specialty (${name})`, value: specialty })
  }

  // Resonance: one die when the roll uses a discipline the current resonance
  // boosts, at Intense or Acute.
  const disciplineSlot = slots.find((slot) => slot?.kind === 'discipline' && slot.id)
  const resonance = readResonance(actor)
  const resonanceApplies =
    disciplineSlot && resonance.boosts.includes(disciplineSlot.id)
  const resonanceBonus = options.useResonance && resonanceApplies ? 1 : 0
  if (resonanceBonus) parts.push({ label: 'Resonance', value: resonanceBonus })

  // Blood Potency adds dice to discipline pools, so only when a discipline is
  // actually part of the roll — rolling Strength + Brawl while benefiting from
  // Potence gets nothing, which is how the book reads it.
  const powerBonus = disciplineSlot ? row.powerBonus : 0
  if (powerBonus) parts.push({ label: 'Blood Potency', value: powerBonus })

  // Impairment: two dice off pools using the affected attribute category.
  const usedAttributes = slots
    .filter((slot) => slot?.kind === 'attribute' && slot.id)
    .map((slot) => slot.id)

  const physicallyImpaired = isImpaired(actor.system.health)
  const mentallyImpaired = isImpaired(actor.system.willpower)

  const usesPhysical = usedAttributes.some((id) => PHYSICAL.includes(id))
  const usesSocialOrMental = usedAttributes.some(
    (id) => SOCIAL.includes(id) || MENTAL.includes(id)
  )

  let penalties = 0
  if (physicallyImpaired && usesPhysical) {
    penalties -= 2
    parts.push({ label: 'Impaired (physical)', value: -2 })
  }
  if (mentallyImpaired && usesSocialOrMental) {
    penalties -= 2
    parts.push({ label: 'Impaired (social/mental)', value: -2 })
  }

  // Heavy armour costs Dexterity pools specifically, not every physical roll.
  const heavyArmor = usedAttributes.includes('dexterity') ? equippedHeavyArmor(actor) : null
  const armorPenalty = heavyArmor ? -(armorRating(heavyArmor)?.dexPenalty ?? 0) : 0
  if (armorPenalty) {
    penalties += armorPenalty
    parts.push({ label: `Armour (${heavyArmor.name})`, value: armorPenalty })
  }

  // Weapon damage is a flat bonus to successes in V5, not extra dice, so it is
  // reported alongside the pool rather than added to it. The first skill in the
  // pool decides which kind of weapon counts.
  const skillSlot = slots.find((slot) => slot?.kind === 'skill' && slot.id)
  const weaponType =
    skillSlot?.id === 'melee' ? 'melee' : skillSlot?.id === 'firearms' ? 'ranged' : null
  const weaponBonusAvailable = weaponType ? equippedWeaponBonus(actor, weaponType) : 0
  const weaponBonus = options.useWeaponDamage ? weaponBonusAvailable : 0

  // Brawl is unarmed, so it never draws an equipped melee weapon's damage.
  const unequippedWarning = Boolean(
    weaponType &&
      ownedWeaponCount(actor, weaponType) > 0 &&
      equippedWeaponCount(actor, weaponType) === 0
  )

  const raw =
    traitsTotal + Number(modifier) + surge + specialty + resonanceBonus + powerBonus + penalties

  // A Storyteller's modifier alone should not produce a roll, and penalties
  // never take a real pool below one die.
  const total = traitsTotal > 0 ? Math.max(1, raw) : 0
  const flooredToOne = traitsTotal > 0 && penalties < 0 && raw < 1

  return {
    parts,
    traitsTotal,
    total,
    flooredToOne,
    surge,
    specialtyChoices,
    chosenSpecialty,
    specialtyAvailable: specialtyChoices.length > 0,
    resonance,
    resonanceAvailable: Boolean(resonanceApplies),
    potency,
    weaponType,
    weaponBonusAvailable,
    weaponBonus,
    unequippedWarning,
    canRoll: total > 0,
    label: slots.filter((slot) => slot?.id).map((slot) => slot.label).join(' + ')
  }
}
