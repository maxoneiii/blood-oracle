import { useEffect, useRef, useState } from 'react'
import DotTracker from './DotTracker.jsx'
import { warnLocked } from '../lock.js'

/**
 * wod5e stores specialties as bonus records on the skill:
 *   { source: 'grappling', value: 1, paths: ['skills.brawl'] }
 *
 * The standalone app kept a single free-text specialty per skill. We read all
 * bonus sources for display and write back a single record, which keeps the
 * inline editing of the original while staying legible to the native sheet.
 */
export function readSpecialty(actor, skillId) {
  const bonuses = actor.system.skills?.[skillId]?.bonuses ?? []
  return bonuses.map((bonus) => bonus.source).filter(Boolean).join(', ')
}

export async function writeSpecialty(actor, skillId, text) {
  const value = String(text ?? '').trim()
  const bonuses = value
    ? [{ source: value, value: 1, paths: [`skills.${skillId}`], displayWhenInactive: true }]
    : []
  await actor.update({ [`system.skills.${skillId}.bonuses`]: bonuses })
}

export default function SkillRow({ actor, entry, editable, locked, onRoll }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  const dots = Number(foundry.utils.getProperty(actor, entry.path)) || 0
  const specialty = readSpecialty(actor, entry.id)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const startEditing = () => {
    if (!editable) return
    // A specialty is part of the character's rating, so the padlock covers it.
    if (locked) return warnLocked()
    setDraft(specialty)
    setEditing(true)
  }

  const commit = async () => {
    setEditing(false)
    if (draft.trim() !== specialty) await writeSpecialty(actor, entry.id, draft)
  }

  return (
    <div className="bo-stat-row">
      <div className="bo-stat-name">
        <button type="button" className="bo-trait-name" onClick={() => onRoll(entry)} title={entry.label}>
          {entry.label}
        </button>

        {/* Specialties only exist once the skill has dots, as in the original. */}
        {dots > 0 ? (
          editing ? (
            <input
              ref={inputRef}
              type="text"
              className="bo-specialty-input"
              value={draft}
              placeholder="grappling, dirty fighting…"
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit()
                if (event.key === 'Escape') setEditing(false)
              }}
            />
          ) : specialty ? (
            <span className="bo-specialty" onClick={startEditing} title={specialty}>
              ({specialty})
            </span>
          ) : editable && !locked ? (
            <span className="bo-specialty is-placeholder" onClick={startEditing}>
              + add specialty
            </span>
          ) : null
        ) : null}
      </div>

      <DotTracker
        value={dots}
        disabled={!editable}
        locked={locked}
        onChange={(next) => actor.update({ [entry.path]: next })}
      />
    </div>
  )
}
