import { BloodOracleSheet } from './sheet/blood-oracle-sheet.js'
import { BloodOracleBoardSheet } from './sheet/board-sheet.js'
import { MODULE_ID } from './constants.js'
import { loadRules, getRules, RULES_PATH_SETTING, DEFAULT_RULES_PATH } from './app/rules/catalog.js'
import { registerStatuses, registerStatusHooks, syncStatuses } from './statuses.js'
import { registerLockSetting } from './app/lock.js'
import './styles/blood-oracle.css'

export { MODULE_ID }

Hooks.once('init', () => {
  // wod5e registers its own sheets with `makeDefault: true`. We register
  // alongside them with `makeDefault: false`, so nothing changes until a user
  // picks Blood Oracle in an actor's Sheet Configuration dialog.
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, MODULE_ID, BloodOracleSheet, {
    // Mortals and ghouls share the vampire's data model, so the same sheet
    // serves all three; what differs is which tabs it shows.
    types: ['vampire', 'ghoul', 'mortal', 'spc', 'group'],
    makeDefault: false,
    label: 'Blood Oracle'
  })

  // Any journal can become a detective board by picking this sheet. That gives
  // the table as many boards as it wants, in folders, with Foundry's own
  // permissions deciding who can open a private investigation.
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    JournalEntry,
    MODULE_ID,
    BloodOracleBoardSheet,
    {
      types: ['base'],
      makeDefault: false,
      label: 'Blood Oracle — Detective board'
    }
  )

  // Path to the rules reference, relative to Foundry's Data directory. Empty
  // disables the reference entirely; the sheet still works by hand.
  game.settings.register(MODULE_ID, RULES_PATH_SETTING, {
    name: 'Rules reference file',
    hint:
      'Path within the Foundry Data directory to a rules JSON produced by tools/extract-rules.mjs. ' +
      'Leave empty to run without a reference. The file is never bundled with this module.',
    scope: 'world',
    config: true,
    type: String,
    default: DEFAULT_RULES_PATH,
    requiresReload: false,
    onChange: () => loadRules({ force: true })
  })

  // Token bars need nothing from us: wod5e already declares health and
  // willpower as the token attributes. Statuses are what it lacks.
  registerLockSetting()
  registerStatuses()
  registerStatusHooks()

  console.log('Blood Oracle | Sheet registered for vampire actors.')
})

Hooks.once('ready', async () => {
  if (game.system.id !== 'wod5e') {
    ui.notifications.error(
      'Blood Oracle requires the World of Darkness 5e system and will not function here.'
    )
    return
  }

  if (!globalThis.WOD5E?.api?.Roll) {
    ui.notifications.error(
      'Blood Oracle could not find the WOD5E roll API. The system may have changed its public interface.'
    )
  }

  // Loaded once per client. A missing file is a supported state, so failure
  // here is logged rather than surfaced as an error.
  // Bring existing actors in line once, so statuses are correct on first load
  // rather than only after the next edit.
  for (const actor of game.actors) {
    if (actor.isOwner) syncStatuses(actor)
  }

  await loadRules()
  const rules = getRules()
  if (rules) {
    console.log(`Blood Oracle | Rules reference loaded: ${rules.entries.length} entries.`)
  }
})
