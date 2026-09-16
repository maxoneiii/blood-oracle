import { MODULE_ID } from '../constants.js'

/**
 * A padlock that protects ratings from stray clicks.
 *
 * It guards dots and nothing else. Anything that changes during play — damage,
 * hunger, humanity, resonance, notes, experience, equipping — stays live, and
 * so does anything reached through a button, since a button press is never
 * accidental in the way a click on a row of dots is.
 *
 * The state is per user rather than per actor: it is a personal guard against
 * one's own misclicks, not a statement about the character, and two people
 * should not be able to toggle it for each other.
 */

export const LOCK_SETTING = 'sheetLocked'

export function registerLockSetting() {
  game.settings.register(MODULE_ID, LOCK_SETTING, {
    name: 'Lock ratings',
    hint: 'Protects dots from stray clicks. Toggled from the padlock on any sheet.',
    scope: 'client',
    config: false,
    type: Boolean,
    default: true
  })
}

export function isLocked() {
  try {
    return game.settings.get(MODULE_ID, LOCK_SETTING) === true
  } catch {
    return false
  }
}

export async function setLocked(locked) {
  await game.settings.set(MODULE_ID, LOCK_SETTING, Boolean(locked))
}

let warnedAt = 0

/** Explain the lock rather than doing nothing, but do not spam on a fast click. */
export function warnLocked() {
  const now = Date.now()
  if (now - warnedAt < 2500) return
  warnedAt = now
  ui.notifications.warn('Ratings are locked. Use the padlock at the top of the sheet to edit them.')
}
