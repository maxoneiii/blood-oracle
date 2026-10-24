import { useState } from 'react'
import { Modal, GhostButton } from './primitives.jsx'
import { ARMOR_VALUES, ARMOR_BY_ID } from '../schema/inventory.js'

/**
 * Adding or editing armour: class and name, the same way weapons are added.
 * The class decides the rating and its drawbacks, so nobody looks them up.
 *
 * `initial` is { name, classId } when editing, absent when adding.
 * `onSubmit` receives { name, classId }.
 */
export default function ArmorDialog({ initial, onSubmit, onClose }) {
  const [classId, setClassId] = useState(initial?.classId ?? null)
  const [name, setName] = useState(initial?.name ?? '')
  const [busy, setBusy] = useState(false)

  const editing = Boolean(initial)
  const chosen = classId ? ARMOR_BY_ID[classId] : null
  const ready = Boolean(chosen && name.trim())

  const submit = async () => {
    if (!ready || busy) return
    setBusy(true)
    try {
      await onSubmit({ name: name.trim(), classId })
      onClose()
    } catch (error) {
      console.error('Blood Oracle | Saving the armour failed', error)
      ui.notifications.error('Blood Oracle: could not save the armour. See the console.')
      setBusy(false)
    }
  }

  return (
    <Modal title={editing ? 'Edit armour' : 'Add armour'} onClose={onClose}>
      <div className="bo-label">Armour class</div>
      <div className="bo-weapon-classes">
        {ARMOR_VALUES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={classId === entry.id ? 'bo-weapon-class is-selected' : 'bo-weapon-class'}
            onClick={() => setClassId(entry.id)}
          >
            <span className="bo-weapon-bonus">{entry.dice}</span>
            <span className="bo-weapon-text">
              <span className="bo-weapon-class-name">{entry.label}</span>
              <span className="bo-weapon-examples">{entry.examples}</span>
              {entry.note ? <span className="bo-weapon-note">{entry.note}</span> : null}
            </span>
          </button>
        ))}
      </div>

      <label className="bo-field-label" style={{ marginTop: '16px' }}>
        <span>Name</span>
        <input
          type="text"
          className="bo-field"
          value={name}
          placeholder="Bikers’ leathers"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
        />
      </label>

      <div className="bo-grant-footer">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <GhostButton tone="accent" disabled={!ready || busy} onClick={submit}>
          {editing ? 'Save' : 'Add'}
        </GhostButton>
      </div>
    </Modal>
  )
}
