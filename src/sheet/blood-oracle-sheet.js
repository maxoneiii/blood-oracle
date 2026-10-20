import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../app/App.jsx'
import ErrorBoundary from '../app/components/ErrorBoundary.jsx'
import { createStore } from '../app/store.js'
import { syncTracks } from '../app/schema/derived.js'

const { DocumentSheetV2 } = foundry.applications.api

/**
 * A Vampire actor sheet whose entire content area is owned by React.
 *
 * Foundry's normal render cycle rebuilds DOM on every document update, which
 * would destroy React's tree and any local UI state (open dialogs, in-progress
 * pool building). Instead we render the mount point exactly once and turn every
 * subsequent Foundry render into a store update that React reconciles itself.
 *
 * The one case that *does* require a rebuild is V14's detached windows: when a
 * window is popped out, its content is re-parented into a different browser
 * document. A React root is bound to the document it was created in, so we
 * detect the change by comparing `ownerDocument` and remount.
 */
export class BloodOracleSheet extends DocumentSheetV2 {
  static DEFAULT_OPTIONS = {
    classes: ['blood-oracle'],
    position: { width: 1040, height: 820 },
    window: {
      resizable: true,
      icon: 'fa-solid fa-droplet'
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

  get actor() {
    return this.document
  }

  get title() {
    return this.document.name
  }

  /**
   * Build the plain object React consumes. The live actor is passed through
   * rather than a deep clone so components can read derived data that the
   * system computes in `prepareData`. `rev` gives the snapshot a fresh identity
   * on every update, which is what drives `useSyncExternalStore` to re-render.
   */
  #snapshot(rev) {
    const actor = this.document
    return {
      rev,
      actor,
      actorId: actor.id,
      name: actor.name,
      img: actor.img,
      editable: this.isEditable,
      // Ownership, not the LIMITED flag, decides who sees the full sheet:
      // an OBSERVER is not "limited" but must not read private data either.
      isOwner: actor.isOwner,
      limited: actor.limited,
      isGM: game.user.isGM,
      sheet: this
    }
  }

  #rev = 0

  // React writes the DOM, so there is nothing for Foundry to produce here.
  async _renderHTML() {
    return null
  }

  _replaceHTML(result, content, options) {
    const doc = content.ownerDocument

    // Detached into (or re-attached out of) another window, or Foundry rebuilt
    // the frame from scratch. Either way the old root is no longer valid.
    const mountIsStale =
      !this.#root || this.#hostDocument !== doc || !content.contains(this.#mount)

    this.#store.set(this.#snapshot(++this.#rev))

    if (mountIsStale) {
      this.#teardown()

      this.#mount = doc.createElement('div')
      this.#mount.className = 'blood-oracle-root'
      content.replaceChildren(this.#mount)

      this.#hostDocument = doc

      // Correct stale maximums on open, for when no Storyteller was connected
      // to do it at load. A no-op when they already match.
      if (this.isEditable) queueMicrotask(() => syncTracks(this.document))

      this.#root = createRoot(this.#mount)
      this.#root.render(
        createElement(ErrorBoundary, null, createElement(App, { store: this.#store }))
      )
    }
  }

  #teardown() {
    const root = this.#root
    this.#root = null
    this.#mount = null
    this.#hostDocument = null

    // Unmounting synchronously from inside a React lifecycle throws; defer it.
    if (root) queueMicrotask(() => root.unmount())
  }

  _onClose(options) {
    super._onClose(options)
    this.#teardown()
  }
}

// Belt and braces: pin the class name explicitly, so the sheet's registered id
// stays `blood-oracle.BloodOracleSheet` no matter how the bundle is built.
// Foundry stores that id in the world; if it ever changes, every actor silently
// reverts to the system's own sheet.
Object.defineProperty(BloodOracleSheet, 'name', { value: 'BloodOracleSheet' })
