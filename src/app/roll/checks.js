/**
 * Rouse checks and frenzy resistance.
 *
 * wod5e implements both internally but does not export them, so these mirror
 * its own logic in `actor/vtm/scripts/rouse.js` and `frenzy-roll.js` through
 * the public roll API.
 */

/** Undamaged willpower, which is the pool for a willpower roll. */
export function willpowerPool(actor) {
  const willpower = actor.system?.willpower ?? {}
  return Math.max((willpower.max ?? 0) - (willpower.aggravated ?? 0) - (willpower.superficial ?? 0), 0)
}

/**
 * A bare Rouse check: one hunger die, no normal dice, hunger rises on a
 * failure. Rerolls from Blood Potency apply to powers of a given level, so
 * they are left out here — this is the standalone check, not a power's cost.
 */
export async function rouseCheck(actor, { title } = {}) {
  await WOD5E.api.Roll({
    advancedDice: 1,
    disableBasicDice: true,
    actor,
    data: actor.system,
    title: title || game.i18n.localize('WOD5E.VTM.RousingBlood'),
    increaseHunger: true,
    selectors: ['rouse'],
    quickRoll: true
  })
}

/**
 * Resisting frenzy: willpower plus a third of Humanity, minimum one die,
 * matching the system's own calculation.
 */
export async function resistFrenzy(actor) {
  const choice = await foundry.applications.api.DialogV2.wait({
      classes: ['blood-oracle', 'bo-dialog'],
    window: { title: game.i18n.localize('WOD5E.VTM.ResistingFrenzy') },
    content: `<p>${game.i18n.localize('WOD5E.VTM.FrenzyChoiceResistOrGiveIn')}</p>`,
    modal: true,
    buttons: [
      { label: game.i18n.localize('WOD5E.ItemsList.Resist'), action: 'resist' },
      { label: game.i18n.localize('WOD5E.VTM.GiveIn'), action: 'give-in' }
    ]
  })

  if (choice !== 'resist') {
    // The system's own end-frenzy handler writes `system.frenzyActive`, but that
    // field is only declared on the werewolf model — a vampire's DataModel would
    // discard it. Until the system adds it, giving in is recorded in chat.
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong> gives in to the Beast.</p>`
    })
    return
  }

  const humanity = actor.system?.humanity?.value ?? 0
  const pool = Math.max(willpowerPool(actor) + Math.floor(humanity / 3), 1)

  await WOD5E.api.Roll({
    basicDice: pool,
    disableAdvancedDice: true,
    actor,
    data: actor.system,
    title: game.i18n.localize('WOD5E.VTM.ResistingFrenzy'),
    difficulty: 3,
    selectors: ['frenzy'],
    quickRoll: true
  })
}
