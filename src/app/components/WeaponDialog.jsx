import { useState } from 'react'
import { Modal, GhostButton } from './primitives.jsx'
import { WEAPON_CLASSES, WEAPON_CLASS_BY_ID } from '../schema/inventory.js'

/**
 * Adding or editing a weapon: range, class, name. The class decides the damage
 * bonus, so the player never has to look the number up.
 *
 * `initial` is { name, range, classId } when editing, absent when adding.
 * `onSubmit` receives { name, classId }.
 */
export default function WeaponDialog({ initial, onSubmit, onClose }) {
  const [range, setRange] = useState(initial?.range ?? 'melee')
  const [classId, setClassId] = useState(initial?.classId ?? null)
  const [name, setName] = useState(initial?.name ?? '')
  const [busy, setBusy] = useState(false)

  const editing = Boolean(initial)
  const classes = WEAPON_CLASSES.filter((entry) => entry.range === range)
  const chosen = classId ? WEAPON_CLASS_BY_ID[classId] : null
  const ready = Boolean(chosen && chosen.range === range && name.trim())

  const switchRange = (next) => {
    if (next === range) return
    setRange(next)
    setClassId(null)
  }

  const submit = async () => {
    if (!ready || busy) return
    setBusy(true)
    try {
      await onSubmit({ name: name.trim(), classId })
      onClose()
    } catch (error) {
      console.error('Blood Oracle | Saving the weapon failed', error)
      ui.notifications.error('Blood Oracle: could not save the weapon. See the console.')
      setBusy(false)
    }
  }

  return (
    <Modal title={editing ? 'Edit weapon' : 'Add a weapon'} onClose={onClose}>
      <div className="bo-label">Range</div>
      <div className="bo-weapon-range">
        {['melee', 'ranged'].map((value) => (
          <button
            key={value}
            type="button"
            className={range === value ? 'bo-grant-option is-selected' : 'bo-grant-option'}
            onClick={() => switchRange(value)}
          >
            {value === 'melee' ? 'Melee' : 'Ranged'}
          </button>
        ))}
      </div>

      <div className="bo-label" style={{ marginTop: '16px' }}>
        Weapon class
      </div>
      <div className="bo-weapon-classes">
        {classes.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={classId === entry.id ? 'bo-weapon-class is-selected' : 'bo-weapon-class'}
            onClick={() => setClassId(entry.id)}
          >
            <span className="bo-weapon-bonus">+{entry.bonus}</span>
            <span>
              <span className="bo-weapon-class-name">{entry.label}</span>
              <span className="bo-weapon-examples">{entry.examples}</span>
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
          placeholder="Grandfather's sabre"
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
