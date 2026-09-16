/**
 * Blood Potency table, indexed by rating 0..10, carried over from the
 * standalone app.
 */
/**
 * Checked against the corebook's Blood Potency table.
 *
 * Bane Severity here differs from the standalone app, which has it one lower
 * from Blood Potency 1 upwards. The book and wod5e agree on 0, 2, 2, 3, 3, 4,
 * 4, 5, 5, 6, 6 — so the app is the one that needs correcting, not this.
 */
export const BP_TABLE = [
  { surge: 1, mend: 1, powerBonus: 0, rouseReroll: 0, bane: 0 },
  { surge: 2, mend: 1, powerBonus: 0, rouseReroll: 1, bane: 2 },
  { surge: 2, mend: 2, powerBonus: 1, rouseReroll: 1, bane: 2 },
  { surge: 3, mend: 2, powerBonus: 1, rouseReroll: 2, bane: 3 },
  { surge: 3, mend: 3, powerBonus: 2, rouseReroll: 2, bane: 3 },
  { surge: 4, mend: 3, powerBonus: 2, rouseReroll: 3, bane: 4 },
  { surge: 4, mend: 3, powerBonus: 3, rouseReroll: 3, bane: 4 },
  { surge: 5, mend: 3, powerBonus: 3, rouseReroll: 4, bane: 5 },
  { surge: 5, mend: 4, powerBonus: 4, rouseReroll: 4, bane: 5 },
  { surge: 6, mend: 4, powerBonus: 4, rouseReroll: 5, bane: 6 },
  { surge: 6, mend: 5, powerBonus: 5, rouseReroll: 5, bane: 6 }
]

export function bloodPotencyRow(potency) {
  return BP_TABLE[Math.max(0, Math.min(10, Number(potency) || 0))]
}

/**
 * Which disciplines a resonance boosts, at Intense or Acute. Keyed by the
 * system's discipline keys rather than the standalone app's display names.
 */
export const RESONANCE_DISCIPLINES = {
  choleric: ['celerity', 'potence'],
  melancholy: ['fortitude', 'obfuscate'],
  phlegmatic: ['auspex', 'dominate'],
  sanguine: ['sorcery', 'presence'],
  animal: ['animalism', 'protean'],
  empty: ['oblivion']
}

/** Only these temperaments grant the bonus die. */
const BOOSTING_TEMPERAMENTS = ['intense', 'acute']

/**
 * Resonance is an item on the actor: its name is the humour, and the
 * temperament sits in our flags because wod5e has no field for it.
 */
export function readResonance(actor) {
  const item = actor.items.find((entry) => entry.type === 'resonance')
  if (!item) return { humour: '', temperament: '', boosts: [] }

  const humour = String(item.name ?? '').trim().toLowerCase()
  const temperament = String(item.getFlag('blood-oracle', 'temperament') ?? '')
  const boosting = BOOSTING_TEMPERAMENTS.some((entry) =>
    temperament.toLowerCase().includes(entry)
  )

  return {
    humour,
    temperament,
    boosts: boosting ? RESONANCE_DISCIPLINES[humour] ?? [] : []
  }
}
