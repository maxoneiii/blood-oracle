import { toDisciplineKey, buildPowerItemData } from './disciplines.js'
import { addCustomDiscipline, canEditCustomDisciplines } from './custom-disciplines.js'
import { findEntryByName } from '../rules/catalog.js'
import { MODULE_ID } from '../../constants.js'

/**
 * Imports the discipline portion of a Blood Oracle character export.
 *
 * The export carries the character only, not the rules database, so powers
 * arrive as names and levels. Rules text is attached later, once the reference
 * data is loaded separately.
 */
export async function importDisciplines(actor, character) {
  const disciplines = Array.isArray(character?.disciplines) ? character.disciplines : []
  if (!disciplines.length) {
    return { disciplines: 0, powers: 0, skipped: [] }
  }

  const systemDisciplines = foundry.utils.deepClone(actor.system.disciplines ?? {})
  const powerData = []
  const created = []
  const skipped = []

  for (const entry of disciplines) {
    let key = toDisciplineKey(entry.name)

    if (!key) {
      // Homebrew disciplines get registered with the system, the same way the
      // storyteller menu would, so they behave like any other discipline.
      const label = entry.customName || entry.name
      if (!canEditCustomDisciplines()) {
        skipped.push(label)
        continue
      }
      const custom = await addCustomDiscipline(label)
      if (!custom) {
        skipped.push(label)
        continue
      }
      key = custom.id
      created.push(label)
    }

    systemDisciplines[key] = {
      ...(systemDisciplines[key] ?? {}),
      value: Number(entry.dots) || 0,
      visible: true
    }

    for (const power of entry.powers ?? []) {
      const rawName = power.customName || power.name
      if (!rawName) continue
      // The export carries only names, so level and rules text come from the
      // reference when it is loaded. Without it the power still imports, just
      // bare, and can be filled in by hand.
      const entry = findEntryByName(rawName)

      powerData.push(
        buildPowerItemData({
          rawName,
          disciplineKey: key,
          level: entry?.level ?? 0,
          rules: entry ?? {}
        })
      )
    }
  }

  await actor.update({ 'system.disciplines': systemDisciplines })

  // Replace any powers a previous import created, so re-importing is idempotent
  // rather than cumulative.
  const previous = actor.items.filter(
    (item) => item.type === 'power' && item.getFlag(MODULE_ID, 'originalName')
  )
  if (previous.length) {
    await actor.deleteEmbeddedDocuments(
      'Item',
      previous.map((item) => item.id)
    )
  }

  if (powerData.length) {
    await actor.createEmbeddedDocuments('Item', powerData)
  }

  return {
    disciplines: disciplines.length - skipped.length,
    powers: powerData.length,
    enriched: powerData.filter((power) => power.system.description).length,
    created,
    skipped
  }
}

/** Prompts for a file and hands the parsed character to the importer. */
export async function promptImport(actor) {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'

    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)

      try {
        const character = JSON.parse(await file.text())
        const result = await importDisciplines(actor, character)

        let message = `Imported ${result.powers} powers across ${result.disciplines} disciplines.`
        if (result.powers) {
          message += ` ${result.enriched} matched the rules reference.`
        }
        if (result.created.length) {
          message += ` Created custom disciplines: ${result.created.join(', ')}.`
        }
        if (result.skipped.length) {
          message += ` Skipped (GM rights needed): ${result.skipped.join(', ')}.`
        }
        ui.notifications.info(message)
        resolve(result)
      } catch (error) {
        console.error('Blood Oracle | Import failed', error)
        ui.notifications.error('Could not read that file as a Blood Oracle export.')
        resolve(null)
      }
    })

    input.click()
  })
}
