import { bloodPotencyRow } from './tables.js'
import { readPowerRules } from '../schema/disciplines.js'
import { isEmptyValue } from '../components/primitives.jsx'

/**
 * Work out what a power costs from its own wording.
 *
 * The books are not uniform: most powers say "One Rouse Check", but some say
 * "Free or one Rouse Check", and a few "One or more Rouse Checks". Where the
 * text leaves a choice, the player makes it rather than the module guessing.
 */
export function costOptions(item) {
  const rules = readPowerRules(item)
  const text = String(rules.cost ?? '').trim()
  const fallback = Math.max(0, Number(item.system.cost) || 0)

  if (!text) {
    return fallback > 0 ? { ask: false, rouse: fallback } : { ask: false, rouse: 0 }
  }

  const mentionsFree = /\bfree\b|\bnone\b|no additional cost/i.test(text)
  const mentionsRouse = /rouse/i.test(text)

  // "One or more" and "One or two" ask for a count — but only when the thing
  // being counted is Rouse checks. Some powers cost "one or more Stains".
  if (mentionsRouse && /\bone or (more|two)\b/i.test(text)) {
    return {
      ask: true,
      text,
      options: [
        { label: 'One Rouse check', rouse: 1 },
        { label: 'Two Rouse checks', rouse: 2 },
        { label: 'Three Rouse checks', rouse: 3 }
      ]
    }
  }

  // Free in some circumstances, a Rouse check in others.
  if (mentionsFree && mentionsRouse) {
    return {
      ask: true,
      text,
      options: [
        { label: 'Free', rouse: 0 },
        { label: `Rouse check${fallback > 1 ? ` ×${fallback}` : ''}`, rouse: Math.max(1, fallback) }
      ]
    }
  }

  if (mentionsFree) return { ask: false, rouse: 0 }
  return { ask: false, rouse: Math.max(fallback, mentionsRouse ? 1 : 0) }
}

/**
 * What a power offers on the sheet.
 *
 * A pool means it can be rolled. No pool but a cost means the only thing to do
 * is pay for it. Neither means the power simply takes effect, and a button
 * would be noise.
 */
export function powerAction(item) {
  const hasPool = Object.keys(item.system.dicepool ?? {}).length > 0
  if (hasPool) return 'roll'

  const cost = costOptions(item)
  return cost.ask || cost.rouse > 0 ? 'rouse' : 'none'
}

/** Ask the player which cost applies, returning the number of Rouse checks. */
async function chooseCost(item, cost) {
  const choice = await foundry.applications.api.DialogV2.wait({
      classes: ['blood-oracle', 'bo-dialog'],
    window: { title: item.name },
    content:
      `<p>${foundry.utils.escapeHTML(cost.text)}</p>` +
      '<p style="opacity:0.75">How is it paid for this use?</p>',
    modal: true,
    buttons: cost.options.map((option, index) => ({
      label: option.label,
      action: String(index)
    }))
  })

  if (choice === null || choice === undefined) return null
  return cost.options[Number(choice)]?.rouse ?? 0
}

/**
 * Roll a power, ritual or ceremony from its entry on the sheet.
 *
 * The pool comes from the item's own `dicepool`, which our schema layer fills
 * in from the reference ("Resolve + Auspex" becomes two trait paths). This
 * mirrors the system's `_rollItem`, but goes through the public API.
 */
/**
 * Settle how many Rouse checks this use costs, asking when the book leaves a
 * choice. Returns null if the player cancelled.
 */
async function resolveCost(actor, item) {
  const isVampire = actor.system?.gamesystem === 'vampire' && actor.type !== 'ghoul'
  const cost = costOptions(item)

  if (!cost.ask) return isVampire ? cost.rouse : 0
  if (!isVampire) return 0

  return chooseCost(item, cost)
}

/** Pay a power's cost without rolling — for powers that have no dice pool. */
export async function payPowerCost(actor, item) {
  const rouseCount = await resolveCost(actor, item)
  if (rouseCount === null) return
  if (rouseCount > 0) await rousePower(actor, item, rouseCount)
}

/** The opposing pool's wording, or '' when the power is not contested. */
export function opposingPoolText(item) {
  const text = String(readPowerRules(item).opposingPool ?? '').trim()
  return isEmptyValue(text) ? '' : text
}

const MAX_OPPOSING_DICE = 20

/**
 * The opposing pool belongs to someone else, so the sheet cannot read it.
 * The player says how many dice it comes to. Resolves null on cancel.
 */
async function askOpposingDice(item, text) {
  const escape = foundry.utils.escapeHTML
  const dice = await foundry.applications.api.DialogV2.prompt({
    classes: ['blood-oracle', 'bo-dialog'],
    window: { title: `Opposing roll — ${item.name}` },
    content:
      `<p>Opposed by <strong>${escape(text)}</strong>.</p>` +
      '<p style="opacity:0.75">How many dice does the opposing pool come to?</p>' +
      `<input type="number" name="dice" class="bo-opposing-dice" min="1" max="${MAX_OPPOSING_DICE}" ` +
      'step="1" required autofocus>',
    ok: {
      label: 'Roll both',
      callback: (event, button) => button.form.elements.dice.valueAsNumber
    },
    rejectClose: false,
    modal: true
  })

  if (dice === null || dice === undefined || Number.isNaN(dice)) return null
  return Math.max(1, Math.min(MAX_OPPOSING_DICE, Math.floor(dice)))
}

/** The opponent's roll: plain dice, no Hunger, no bonuses from this sheet. */
async function rollOpposing(actor, item, text, dice) {
  await WOD5E.api.Roll({
    basicDice: dice,
    disableAdvancedDice: true,
    actor,
    data: actor.system,
    title: `Opposing roll — ${item.name}`,
    flavor: text,
    selectors: [],
    quickRoll: true,
    callback: (error) => {
      if (error) console.error('Blood Oracle | Opposing roll failed', error)
    }
  })
}

export async function rollPower(actor, item) {
  const isVampireActor = actor.system?.gamesystem === 'vampire' && actor.type !== 'ghoul'

  const dicepool = item.system.dicepool ?? {}
  const valuePaths = []
  let selectors = ['disciplines', `disciplines.${item.system.discipline}`]

  for (const key of Object.keys(dicepool)) {
    const path = dicepool[key]?.path
    if (!path) continue
    valuePaths.push(`${path}.value`)
    selectors = selectors.concat(path.split('.'), path)
  }

  if (!valuePaths.length) {
    ui.notifications.warn(
      `${item.name} has no dice pool recorded. Add one on the power, or build the pool by hand.`
    )
    return
  }

  const isVampire = isVampireActor

  // A contested power asks for the other side's dice before anything is
  // rolled or paid, so cancelling here cancels the whole action.
  const opposingText = opposingPoolText(item)
  let opposingDice = null
  if (opposingText) {
    opposingDice = await askOpposingDice(item, opposingText)
    if (opposingDice === null) return
  }

  // Settle the cost before rolling, so a cancelled prompt cancels the whole
  // action rather than leaving a roll in chat with no payment.
  const rouseCount = await resolveCost(actor, item)
  if (rouseCount === null) return

  let basicDice = await WOD5E.api.getBasicDice({ valuePaths, flatMod: 0, actor })
  let advancedDice = isVampire ? await WOD5E.api.getAdvancedDice({ actor }) : 0

  // Hunger dice replace normal dice, and here the system clamps them to the
  // pool size — unlike its own sheet roll, which does not. We follow the
  // clamping version: rolling more hunger dice than the pool has is not a rule.
  if (isVampire) {
    advancedDice = Math.min(basicDice, advancedDice)
    basicDice = Math.max(basicDice - advancedDice, 0)
  }

  const rules = readPowerRules(item)

  await WOD5E.api.Roll({
    basicDice,
    advancedDice,
    actor,
    data: actor.system,
    title: item.name,
    flavor: rules.dicePool || item.system.description || '',
    selectors,
    macro: item.system.macroid,
    quickRoll: true,
    callback: async (error) => {
      if (error) {
        console.error('Blood Oracle | Power roll failed', error)
        return
      }
      // The contest reads as one exchange in chat: the power, then straight
      // away the resistance against it.
      if (opposingDice !== null) await rollOpposing(actor, item, opposingText, opposingDice)

      // The check follows the roll so the chat log reads in the order play
      // happens: what was attempted, then what it cost.
      if (isVampire && rouseCount > 0) {
        await rousePower(actor, item, rouseCount)
      }
    }
  })
}

/**
 * The Rouse check a power costs. Blood Potency allows a re-roll for powers up
 * to a given level, which is what `rerollHunger` asks the system for.
 */
export async function rousePower(actor, item, count) {
  const cost = Math.max(1, Number(count) || Number(item.system.cost) || 1)
  const level = Number(item.system.level) || 0
  const potency = Number(actor.system.blood?.potency) || 0
  const rerollLevel = bloodPotencyRow(potency).rouseReroll

  const selectors = ['rouse']
  if (item.system.discipline === 'oblivion') selectors.push('oblivion-rouse')

  await WOD5E.api.Roll({
    advancedDice: cost,
    disableBasicDice: true,
    actor,
    data: actor.system,
    title: game.i18n.localize('WOD5E.VTM.RousingBlood'),
    increaseHunger: true,
    rerollHunger: level > 0 && level <= rerollLevel,
    selectors,
    quickRoll: true
  })
}
