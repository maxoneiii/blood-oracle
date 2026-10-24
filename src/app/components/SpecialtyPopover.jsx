import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { paletteOf, placement } from './floating.js'
import { addSpecialty, renameSpecialty, removeSpecialty } from '../schema/specialties.js'

const grantedNote = (predator) =>
  `Granted by predator type${predator ? `: ${predator}` : ''} — change the predator to remove it.`

/**
 * Hover tooltip listing every specialty of a skill, in the sheet's style
 * rather than the browser's grey title box.
 */
export function SpecialtyTooltip({ anchor, entries, predator }) {
  const [layout, setLayout] = useState(null)

  useLayoutEffect(() => {
    if (!anchor) return
    setLayout({
      position: placement(anchor, { minWidth: 180, maxHeight: 400, needBelow: 120 }),
      palette: paletteOf(anchor)
    })
  }, [anchor])

  if (!anchor || !layout || !entries.length) return null
  // Sized by its own content, not by the row it hangs from.
  const { width, ...position } = layout.position

  return createPortal(
    <div className="bo-spec-tip" style={{ ...layout.palette, ...position }}>
      {entries.map((entry) => (
        <div key={entry.index} className="bo-spec-tip-row">
          <span>{entry.text}</span>
          {entry.granted ? <span className="bo-spec-origin">pred</span> : null}
        </div>
      ))}
      {entries.some((entry) => entry.granted) ? (
        <div className="bo-spec-tip-note">{grantedNote(predator)}</div>
      ) : null}
    </div>,
    document.body
  )
}

function EntryRow({ entry, canEdit, predator, editing, onStartEdit, onCommit, onRemove }) {
  const [draft, setDraft] = useState(entry.text)
  const inputRef = useRef(null)
  const writable = canEdit && !entry.granted

  useLayoutEffect(() => {
    if (!editing) return
    setDraft(entry.text)
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing, entry.text])

  return (
    <div className={entry.granted ? 'bo-spec-pop-row is-granted' : 'bo-spec-pop-row'}>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          className="bo-spec-pop-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => onCommit(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onCommit(draft)
          }}
        />
      ) : (
        <span
          className={writable ? 'bo-spec-pop-text is-writable' : 'bo-spec-pop-text'}
          title={writable ? 'Click to rename' : undefined}
          onClick={writable ? onStartEdit : undefined}
        >
          {entry.text}
        </span>
      )}

      {entry.granted ? (
        <span className="bo-spec-origin" title={grantedNote(predator)}>
          pred
        </span>
      ) : writable && !editing ? (
        <button
          type="button"
          className="bo-spec-pop-remove"
          title="Remove this specialty"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onRemove}
        >
          ×
        </button>
      ) : null}
    </div>
  )
}

/**
 * The full list of a skill's specialties, opened from the skill row: rename by
 * clicking, remove with ×, add at the bottom. Read-only when the sheet is not
 * editable or the padlock is closed. Predator-granted entries never get a ×.
 */
export default function SpecialtyPopover({
  anchor,
  actor,
  skillId,
  skillLabel,
  entries,
  predator,
  canEdit,
  focusAdd,
  onClose
}) {
  const [layout, setLayout] = useState(null)
  const [editingIndex, setEditingIndex] = useState(null)
  const [draft, setDraft] = useState('')

  const boxRef = useRef(null)
  const addRef = useRef(null)
  const editingRef = useRef(null)
  editingRef.current = editingIndex

  useLayoutEffect(() => {
    if (!anchor) return
    setLayout({
      position: placement(anchor, { minWidth: 240, maxHeight: 360 }),
      palette: paletteOf(anchor)
    })
  }, [anchor])

  useLayoutEffect(() => {
    if (layout && focusAdd && canEdit) addRef.current?.focus()
  }, [layout, focusAdd, canEdit])

  // Close on a click elsewhere, on Escape, and when anything around it moves —
  // the same rules as the dropdown list.
  useEffect(() => {
    const onPointer = (event) => {
      if (boxRef.current?.contains(event.target) || anchor?.contains(event.target)) return
      onClose()
    }
    const onScroll = (event) => {
      if (boxRef.current?.contains(event.target)) return
      onClose()
    }
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      event.preventDefault()
      // Escape while renaming abandons the rename, not the whole popover.
      if (editingRef.current !== null) {
        editingRef.current = null
        setEditingIndex(null)
      } else onClose()
    }

    document.addEventListener('mousedown', onPointer, true)
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onPointer, true)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [anchor, onClose])

  // Enter and the blur that follows it, or Escape and the blur of the input it
  // removes, would each commit; only the first call while still editing counts.
  const commitRename = async (entry, text) => {
    if (editingRef.current !== entry.index) return
    editingRef.current = null
    setEditingIndex(null)
    if (text.trim() === entry.text) return
    await renameSpecialty(actor, skillId, entry.index, text)
  }

  const submitNew = async () => {
    const text = draft.trim()
    if (!text) return
    const added = await addSpecialty(actor, skillId, text)
    if (added) setDraft('')
    addRef.current?.focus()
  }

  if (!anchor || !layout) return null

  return createPortal(
    <div
      ref={boxRef}
      className="bo-spec-pop"
      style={{ ...layout.palette, ...layout.position }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="bo-spec-pop-head">{skillLabel} · specialties</div>

      <div className="bo-spec-pop-list">
        {entries.map((entry) => (
          <EntryRow
            key={`${entry.index}-${entry.text}`}
            entry={entry}
            canEdit={canEdit}
            predator={predator}
            editing={editingIndex === entry.index}
            onStartEdit={() => setEditingIndex(entry.index)}
            onCommit={(text) => commitRename(entry, text)}
            onRemove={() => removeSpecialty(actor, skillId, entry.index)}
          />
        ))}
        {!entries.length ? <div className="bo-spec-pop-empty">No specialties yet.</div> : null}
      </div>

      {canEdit ? (
        <div className="bo-spec-pop-add">
          <input
            ref={addRef}
            type="text"
            className="bo-spec-pop-input"
            value={draft}
            placeholder="Add a specialty…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitNew()
            }}
          />
        </div>
      ) : null}
    </div>,
    document.body
  )
}
