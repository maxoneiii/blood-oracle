import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import BoardApp from '../app/board/BoardApp.jsx'
import ErrorBoundary from '../app/components/ErrorBoundary.jsx'
import { createStore } from '../app/store.js'

const { DocumentSheetV2 } = foundry.applications.api

/**
 * A detective board living on a JournalEntry.
 *
 * Journals give us everything the board needs for free: as many boards as the
 * table wants, in folders, with Foundry's own permissions. A board shared with
 * everyone is a journal owned by everyone; a private investigation is a journal
 * only its owner and the Storyteller can open. None of that is our code.
 *
 * The board itself lives in the journal's flags. Mounting mirrors the actor
 * sheet: render once, then turn Foundry's renders into store updates so React
 * keeps its own state through other people's edits.
 */
export class BloodOracleBoardSheet extends DocumentSheetV2 {
  static DEFAULT_OPTIONS = {
    classes: ['blood-oracle'],
    position: { width: 1100, height: 760 },
    window: {
      resizable: true,
      icon: 'fa-solid fa-thumbtack'
    },
    form: {
      submitOnChange: false,
      closeOnSubmit: false
    }
  }

  #root = null
  #mount = null
  #hostDocument = null
  #store = createStore(null)
  #rev = 0

  get journal() {
    return this.document
  }

  get title() {
    return this.document.name
  }

  #snapshot(rev) {
    const journal = this.document
    return {
      rev,
      journal,
      journalId: journal.id,
      name: journal.name,
      editable: this.isEditable,
      isOwner: journal.isOwner,
      isGM: game.user.isGM,
      userId: game.user.id,
      sheet: this
    }
  }

  async _renderHTML() {
    return null
  }

  _replaceHTML(result, content) {
    const doc = content.ownerDocument
    const mountIsStale =
      !this.#root || this.#hostDocument !== doc || !content.contains(this.#mount)

    this.#store.set(this.#snapshot(++this.#rev))

    if (mountIsStale) {
      this.#teardown()

      this.#mount = doc.createElement('div')
      this.#mount.className = 'blood-oracle-root'
      content.replaceChildren(this.#mount)

      this.#hostDocument = doc
      this.#root = createRoot(this.#mount)
      this.#root.render(
        createElement(ErrorBoundary, null, createElement(BoardApp, { store: this.#store }))
      )
    }
  }

  #teardown() {
    const root = this.#root
    this.#root = null
    this.#mount = null
    this.#hostDocument = null
    if (root) queueMicrotask(() => root.unmount())
  }

  _onClose(options) {
    super._onClose(options)
    this.#teardown()
  }
}

// As with the actor sheet: Foundry derives the registered id from the class
// name, so it must survive minification.
Object.defineProperty(BloodOracleBoardSheet, 'name', { value: 'BloodOracleBoardSheet' })
