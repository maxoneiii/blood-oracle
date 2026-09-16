/**
 * Blood Oracle builds the pool; wod5e rolls it.
 *
 * We deliberately do not reimplement V5 dice maths. `WOD5E.api.Roll` owns the
 * custom `dv`/`dg` dice terms, the chat card, Dice So Nice, hunger increase on
 * failure and willpower damage — all of which the table needs to see.
 */

/** Hunger only applies to full vampires; ghouls roll no hunger dice. */
export function getHungerDice(actor) {
  if (actor.system?.gamesystem !== 'vampire') return 0
  if (actor.type === 'ghoul') return 0
  return Math.max(actor.system?.hunger?.value ?? 0, 0)
}

/**
 * Split the pool the same way the system's own sheet does, in
 * `actor/scripts/roll.js`: hunger dice replace basic dice.
 *
 * Note this reproduces a system quirk — when hunger exceeds the pool, wod5e
 * still rolls the full hunger count rather than clamping to the pool size. We
 * match its behaviour on purpose so results are identical to the native sheet.
 */
export function splitPool(pool, hunger) {
  const advancedDice = hunger
  const basicDice = Math.max(pool - advancedDice, 0)
  return { basicDice, advancedDice }
}
