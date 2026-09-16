import { MODULE_ID } from '../../constants.js'

/**
 * The board's data, kept in the journal's flags.
 *
 * Cards are private when created — the safer of the two mistakes — and a card's
 * author is whoever made it. Privacy here is a curtain rather than a wall: the
 * journal is shared, so a determined person could read another's private cards
 * from the console. That is the agreed trade, and it buys a far simpler design.
 *
 * A connection is private when either end is: a line drawn to a secret is
 * itself a secret, and so is its label.
 */

export const BOARD_FLAG = 'board'
export const PALETTE_FLAG = 'palette'
export const CARD_WIDTH = 234

/** Boards borrow the sheet palettes; the choice is per board, not per user. */
export const PALETTES = [
  { id: 'bo-splat-vampire', label: 'Vampire' },
  { id: 'bo-splat-ghoul', label: 'Ghoul' },
  { id: 'bo-splat-mortal', label: 'Mortal' },
  { id: 'bo-splat-spc', label: 'Violet' }
]

export function readPalette(journal) {
  const stored = journal.getFlag(MODULE_ID, PALETTE_FLAG)
  return PALETTES.some((entry) => entry.id === stored) ? stored : 'bo-splat-vampire'
}

export async function setPalette(journal, palette) {
  await journal.setFlag(MODULE_ID, PALETTE_FLAG, palette)
}

export function readBoard(journal) {
  const stored = journal.getFlag(MODULE_ID, BOARD_FLAG)
  return {
    cards: Array.isArray(stored?.cards) ? stored.cards : [],
    connections: Array.isArray(stored?.connections) ? stored.connections : []
  }
}

export async function writeBoard(journal, patch) {
  const board = readBoard(journal)
  await journal.setFlag(MODULE_ID, BOARD_FLAG, { ...board, ...patch })
}

/* --------------------------------------------------------------- visibility */

export function canSeeCard(card, { userId, isGM }) {
  if (!card?.private) return true
  return isGM || card.author === userId
}

export function canSeeConnection(connection, cardsById, viewer) {
  const from = cardsById[connection.from]
  const to = cardsById[connection.to]
  if (!from || !to) return false
  return canSeeCard(from, viewer) && canSeeCard(to, viewer)
}

/** Cards and links this viewer may see, with the links already filtered. */
export function visibleBoard(journal, viewer) {
  const { cards, connections } = readBoard(journal)
  const visibleCards = cards.filter((card) => canSeeCard(card, viewer))

  const byId = {}
  for (const card of cards) byId[card.id] = card

  return {
    cards: visibleCards,
    connections: connections.filter((link) => canSeeConnection(link, byId, viewer)),
    hiddenCount: cards.length - visibleCards.length
  }
}

/* ---------------------------------------------------------------- mutations */

const newId = (prefix) => `${prefix}_${foundry.utils.randomID(10)}`

export async function addCard(journal, { x, y, userId }) {
  const { cards } = readBoard(journal)
  const card = {
    id: newId('card'),
    title: '',
    body: '',
    image: '',
    x,
    y,
    private: true,
    author: userId
  }
  await writeBoard(journal, { cards: [...cards, card] })
  return card
}

export async function updateCard(journal, id, patch) {
  const { cards } = readBoard(journal)
  await writeBoard(journal, {
    cards: cards.map((card) => (card.id === id ? { ...card, ...patch } : card))
  })
}

export async function removeCard(journal, id) {
  const { cards, connections } = readBoard(journal)
  await writeBoard(journal, {
    cards: cards.filter((card) => card.id !== id),
    // A line to a card that no longer exists would render into nothing.
    connections: connections.filter((link) => link.from !== id && link.to !== id)
  })
}

export async function connect(journal, fromId, toId) {
  if (!fromId || fromId === toId) return
  const { connections } = readBoard(journal)

  const exists = connections.some(
    (link) =>
      (link.from === fromId && link.to === toId) || (link.from === toId && link.to === fromId)
  )
  if (exists) return

  await writeBoard(journal, {
    connections: [...connections, { id: newId('link'), from: fromId, to: toId, label: '' }]
  })
}

export async function updateConnection(journal, id, patch) {
  const { connections } = readBoard(journal)
  await writeBoard(journal, {
    connections: connections.map((link) => (link.id === id ? { ...link, ...patch } : link))
  })
}

export async function removeConnection(journal, id) {
  const { connections } = readBoard(journal)
  await writeBoard(journal, { connections: connections.filter((link) => link.id !== id) })
}

/**
 * Publishing someone else's private card is a Storyteller action, and it is not
 * reversible in the sense that matters: the others have seen it. Hence the
 * confirmation, and hence the check on who is asking.
 */
export async function setCardPrivacy(journal, card, isPrivate, viewer) {
  const ownCard = card.author === viewer.userId

  if (!ownCard && !viewer.isGM) {
    ui.notifications.warn('Only the card’s author or the Storyteller can change this.')
    return false
  }

  if (!ownCard && viewer.isGM && !isPrivate) {
    const author = game.users.get(card.author)
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      classes: ['blood-oracle', 'bo-dialog'],
      window: { title: 'Publish this card?' },
      content:
        `<p>This card is private to <strong>${foundry.utils.escapeHTML(author?.name ?? 'another player')}</strong>.</p>` +
        '<p>Publishing it shows the card, and any lines drawn to it, to everyone at the table. That cannot be taken back once seen.</p>'
    })
    if (!confirmed) return false
  }

  await updateCard(journal, card.id, { private: isPrivate })
  return true
}
