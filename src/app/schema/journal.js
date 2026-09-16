import { MODULE_ID } from '../../constants.js'

/* ------------------------------------------------------------------ notes */

/**
 * The standalone app keeps notes as cards with a title, body and image. wod5e
 * has only flat HTML fields, so the cards live in module flags.
 *
 * The summary is mirrored into `system.privatenotes`, never `system.notes`:
 * the system's own limited sheet renders `system.notes` unconditionally under
 * the heading "Public Notes", so anything put there is readable by every player
 * who opens the character. Notes are the character's own.
 */
export function readNotes(actor) {
  const stored = actor.getFlag(MODULE_ID, 'notes')
  return Array.isArray(stored) ? stored : []
}

function summarise(notes) {
  return notes
    .filter((note) => note.title || note.text)
    .map(
      (note) =>
        `<h3>${foundry.utils.escapeHTML(note.title || 'Untitled')}</h3>` +
        `<p>${foundry.utils.escapeHTML(note.text || '')}</p>`
    )
    .join('')
}

async function writeNotes(actor, notes) {
  await actor.setFlag(MODULE_ID, 'notes', notes)

  await actor.update({ 'system.privatenotes': summarise(notes) })
}

export async function addNote(actor) {
  const notes = readNotes(actor)
  const note = { id: foundry.utils.randomID(8), title: '', text: '', image: '' }
  await writeNotes(actor, [...notes, note])
  return note
}

export async function updateNote(actor, id, patch) {
  await writeNotes(
    actor,
    readNotes(actor).map((note) => (note.id === id ? { ...note, ...patch } : note))
  )
}

export async function removeNote(actor, id) {
  await writeNotes(actor, readNotes(actor).filter((note) => note.id !== id))
}

/* ------------------------------------------------------------ experience */

/**
 * Experience maps onto the system's own ledger: `system.experiences` holds
 * records of `{ id, name, value, timestamp }`, where a negative value is a
 * spend. The system derives totals into `system.derivedXP`, so nothing is
 * computed twice.
 */
export function readExperiences(actor) {
  const stored = actor.system.experiences
  return Array.isArray(stored) ? stored : []
}

export function experienceTotals(actor) {
  const derived = actor.system.derivedXP ?? {}
  return {
    total: Number(derived.totalXP) || 0,
    remaining: Number(derived.remainingXP) || 0
  }
}

export async function addExperience(actor, { name, amount, spend }) {
  const value = spend ? -Math.abs(Number(amount) || 0) : Math.abs(Number(amount) || 0)

  const entry = {
    id: foundry.utils.randomID(8),
    name: String(name ?? '').trim() || (spend ? 'Spent' : 'Earned'),
    value,
    timestamp: Date.now()
  }

  await actor.update({ 'system.experiences': [...readExperiences(actor), entry] })
  return entry
}

export async function updateExperience(actor, id, patch) {
  await actor.update({
    'system.experiences': readExperiences(actor).map((entry) =>
      entry.id === id ? { ...entry, ...patch } : entry
    )
  })
}

export async function removeExperience(actor, id) {
  await actor.update({
    'system.experiences': readExperiences(actor).filter((entry) => entry.id !== id)
  })
}
