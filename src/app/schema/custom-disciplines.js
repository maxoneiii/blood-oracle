/**
 * Custom disciplines are a first-class feature of wod5e: it merges anything in
 * the `customDisciplines` world setting into its definition list, so a homebrew
 * discipline gets a real key, real dots and works on the native sheet too.
 *
 * We write to that setting rather than inventing a parallel store. The trade-off
 * is scope: the setting is world-wide, so a discipline added here appears for
 * every character in the world.
 */

const SETTING_SCOPE = 'wod5e'
const SETTING_KEY = 'customDisciplines'

export function readCustomDisciplines() {
  try {
    return game.settings.get(SETTING_SCOPE, SETTING_KEY) ?? []
  } catch (error) {
    console.error('Blood Oracle | Could not read custom disciplines', error)
    return []
  }
}

/** Only a GM can write world settings; players get a clear message instead. */
export function canEditCustomDisciplines() {
  return game.user.isGM
}

export async function addCustomDiscipline(label) {
  const name = String(label ?? '').trim()
  if (!name) return null

  const list = foundry.utils.deepClone(readCustomDisciplines())

  if (list.some((entry) => (entry.label ?? '').toLowerCase() === name.toLowerCase())) {
    ui.notifications.warn(`A custom discipline named "${name}" already exists.`)
    return null
  }

  // Matches the record the system's own storyteller menu creates.
  const entry = { id: foundry.utils.randomID(8), label: name }
  list.push(entry)

  await game.settings.set(SETTING_SCOPE, SETTING_KEY, list)
  return entry
}

export async function renameCustomDiscipline(id, label) {
  const name = String(label ?? '').trim()
  if (!name) return

  const list = foundry.utils.deepClone(readCustomDisciplines())
  const entry = list.find((item) => item.id === id)
  if (!entry) return

  entry.label = name
  await game.settings.set(SETTING_SCOPE, SETTING_KEY, list)
}

/**
 * Removing the definition does not remove dots or powers already recorded on
 * actors, so the caller is expected to warn about that.
 */
export async function removeCustomDiscipline(id) {
  const list = readCustomDisciplines().filter((entry) => entry.id !== id)
  await game.settings.set(SETTING_SCOPE, SETTING_KEY, list)
}

export function isCustomDiscipline(key) {
  return readCustomDisciplines().some((entry) => entry.id === key)
}

/**
 * Every discipline key available in this world: the system's built-ins plus any
 * custom ones. Reading through `getList` means custom entries arrive already
 * merged, with renames applied.
 */
export function getAllDisciplines() {
  const list = WOD5E.Disciplines.getList({ disableSort: true }) ?? {}
  return Object.entries(list).map(([id, value]) => ({
    id,
    label: value.displayName || game.i18n.localize(value.label ?? id),
    custom: value.custom === true
  }))
}
