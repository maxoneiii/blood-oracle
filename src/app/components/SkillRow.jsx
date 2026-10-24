import { useCallback, useRef, useState } from 'react'
import DotTracker from './DotTracker.jsx'
import SpecialtyPopover, { SpecialtyTooltip } from './SpecialtyPopover.jsx'
import { warnLocked } from '../lock.js'
import { readSpecialties, grantingPredator } from '../schema/specialties.js'

/**
 * One skill: name, specialties, dots.
 *
 * A skill can carry several specialties but the row has one line, so it shows
 * the first and a "+N" chip for the rest. Hovering lists them all; clicking
 * opens a popover by the row to rename, remove and add them.
 */
export default function SkillRow({ actor, entry, editable, locked, onRoll }) {
  // null, or { focusAdd }
  const [popover, setPopover] = useState(null)
  const [hovered, setHovered] = useState(false)
  const anchorRef = useRef(null)

  const dots = Number(foundry.utils.getProperty(actor, entry.path)) || 0
  const specialties = readSpecialties(actor, entry.id)
  const hasGranted = specialties.some((item) => item.granted)
  const predator = hasGranted ? grantingPredator(actor) : null
  // A specialty is part of the character's rating, so the padlock covers it.
  const canEdit = editable && !locked

  const closePopover = useCallback(() => setPopover(null), [])

  const open = (focusAdd) => {
    setHovered(false)
    setPopover({ focusAdd })
  }

  const openForAdding = () => {
    if (!editable) return
    if (locked) return warnLocked()
    open(true)
  }

  const [first, ...rest] = specialties

  return (
    <div className="bo-stat-row">
      <div className="bo-stat-name" ref={anchorRef}>
        <button type="button" className="bo-trait-name" onClick={() => onRoll(entry)} title={entry.label}>
          {entry.label}
        </button>

        {/* Specialties only exist once the skill has dots, as in the original —
            except one the predator type granted, which shows regardless. */}
        {dots > 0 || hasGranted ? (
          first ? (
            <span
              className="bo-spec-zone"
              onClick={() => (popover ? closePopover() : open(false))}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              <span className="bo-specialty">
                ({first.text}
                {first.granted ? <span className="bo-origin">pred</span> : null})
              </span>
              {rest.length ? <span className="bo-spec-more">+{rest.length}</span> : null}
            </span>
          ) : canEdit ? (
            <span className="bo-specialty is-placeholder" onClick={openForAdding}>
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

      {hovered && !popover ? (
        <SpecialtyTooltip anchor={anchorRef.current} entries={specialties} predator={predator} />
      ) : null}

      {popover ? (
        <SpecialtyPopover
          anchor={anchorRef.current}
          actor={actor}
          skillId={entry.id}
          skillLabel={entry.label}
          entries={specialties}
          predator={predator}
          canEdit={canEdit}
          focusAdd={popover.focusAdd}
          onClose={closePopover}
        />
      ) : null}
    </div>
  )
}
