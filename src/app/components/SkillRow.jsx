import { useEffect, useRef, useState } from 'react'
import DotTracker from './DotTracker.jsx'
import { warnLocked } from '../lock.js'
import { grantedSpecialties, readJournal } from '../schema/predator-grants.js'

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

/**
 * Each comma-separated entry is its own bonus record. Records whose text is
 * unchanged are kept as they were, so a specialty granted by the predator type
 * stays a record of its own and can be taken back on its own.
 */
export async function writeSpecialty(actor, skillId, text) {
  const existing = actor.system.skills?.[skillId]?.bonuses ?? []
  const names = [...new Set(String(text ?? '').split(',').map((part) => part.trim()).filter(Boolean))]

  const bonuses = names.map(
    (name) =>
      existing.find((bonus) => String(bonus.source ?? '').trim().toLowerCase() === name.toLowerCase()) ?? {
        source: name,
        value: 1,
        paths: [`skills.${skillId}`],
        displayWhenInactive: true
      }
  )
  await actor.update({ [`system.skills.${skillId}.bonuses`]: bonuses })
}

export default function SkillRow({ actor, entry, editable, locked, onRoll }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  const dots = Number(foundry.utils.getProperty(actor, entry.path)) || 0
  const specialty = readSpecialty(actor, entry.id)
  const granted = grantedSpecialties(actor, entry.id).map((text) => text.toLowerCase())
  const journal = granted.length ? readJournal(actor) : null
  const parts = (actor.system.skills?.[entry.id]?.bonuses ?? []).map((bonus) => bonus.source).filter(Boolean)
  const hasGranted = parts.some((part) => granted.includes(part.toLowerCase()))

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

        {/* Specialties only exist once the skill has dots, as in the original —
            except one the predator type granted, which shows regardless. */}
        {dots > 0 || hasGranted ? (
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
              (
              {parts.map((part, i) => (
                <span key={`${i}-${part}`}>
                  {i ? ', ' : ''}
                  {part}
                  {granted.includes(part.toLowerCase()) ? (
                    <span className="bo-origin" title={`Granted by predator type: ${journal?.predator}`}>
                      pred
                    </span>
                  ) : null}
                </span>
              ))}
              )
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
