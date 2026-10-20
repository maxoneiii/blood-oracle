import { useState } from 'react'
import { Modal, GhostButton } from './primitives.jsx'
import {
  emptySelections,
  selectionsComplete,
  blockComplete,
  resolveGrants,
  applyGrants,
  grantLabel,
  needsText,
  clanNote,
  restrictionWarnings
} from '../schema/predator-grants.js'

/**
 * What a predator type grants, with one block per decision. Apply stays off
 * until every decision is made. Nothing is written until Apply.
 */
export default function PredatorGrantsDialog({ actor, predator, onClose }) {
  const [selections, setSelections] = useState(() => emptySelections(predator))
  const [busy, setBusy] = useState(false)

  const warnings = restrictionWarnings(actor, predator)
  const fixed = predator.blocks.filter((block) => block.type === 'fixed')
  const complete = selectionsComplete(predator, selections)

  const patch = (index, change) =>
    setSelections((current) => current.map((s, i) => (i === index ? { ...s, ...change } : s)))

  const apply = async () => {
    if (!complete || busy) return
    setBusy(true)
    try {
      await applyGrants(actor, predator, resolveGrants(predator, selections))
      onClose()
    } catch (error) {
      console.error('Blood Oracle | Applying predator grants failed', error)
      ui.notifications.error('Blood Oracle: could not apply the predator grants. See the console.')
      setBusy(false)
    }
  }

  return (
    <Modal wide title={predator.name} subtitle={`Predator type grants · ${predator.source}`} onClose={onClose}>
      {warnings.map((text) => (
        <p key={text} className="bo-grant-warning">
          {text}
        </p>
      ))}

      {fixed.length ? (
        <div className="bo-grant-block">
          <div className="bo-label">Granted</div>
          <ul className="bo-grant-fixed">
            {fixed.map((block, i) => (
              <li key={i}>{grantLabel(block.grant)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {predator.blocks.map((block, index) => {
        if (block.type === 'choose') {
          return (
            <ChooseBlock
              key={index}
              actor={actor}
              block={block}
              selection={selections[index]}
              onChange={(change) => patch(index, change)}
            />
          )
        }
        if (block.type === 'spread') {
          return (
            <SpreadBlock
              key={index}
              block={block}
              selection={selections[index]}
              onChange={(change) => patch(index, change)}
            />
          )
        }
        return null
      })}

      <div className="bo-grant-footer">
        <GhostButton onClick={onClose}>Not now</GhostButton>
        <GhostButton tone="accent" disabled={!complete || busy} onClick={apply}>
          Apply
        </GhostButton>
      </div>
    </Modal>
  )
}

function BlockHeading({ label, done }) {
  return (
    <div className="bo-label">
      {label}
      <span className={done ? 'bo-grant-state is-done' : 'bo-grant-state'}>{done ? '✓' : 'choose'}</span>
    </div>
  )
}

function ChooseBlock({ actor, block, selection, onChange }) {
  const chosen = selection.option == null ? null : block.options[selection.option]

  return (
    <div className="bo-grant-block">
      <BlockHeading label={block.label} done={blockComplete(block, selection)} />

      <div className="bo-grant-options">
        {block.options.map((grant, i) => {
          const note = clanNote(actor, grant)
          const classes = [
            'bo-grant-option',
            selection.option === i ? 'is-selected' : '',
            note ? 'is-muted' : ''
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={i}
              type="button"
              className={classes}
              title={note || undefined}
              onClick={() => onChange({ option: i, text: '' })}
            >
              {grantLabel(grant)}
              {note || grant.hint ? <span className="bo-grant-note">{note || grant.hint}</span> : null}
            </button>
          )
        })}
      </div>

      {chosen && needsText(chosen) ? (
        <input
          type="text"
          className="bo-field bo-grant-text"
          value={selection.text}
          placeholder={chosen.prompt || 'Specify…'}
          autoFocus
          onChange={(event) => onChange({ text: event.target.value })}
        />
      ) : null}
    </div>
  )
}

function SpreadBlock({ block, selection, onChange }) {
  const spent = selection.alloc.reduce((sum, n) => sum + n, 0)
  const left = block.dots - spent

  const set = (i, value) => {
    const alloc = selection.alloc.map((n, t) => (t === i ? value : n))
    onChange({ alloc })
  }

  return (
    <div className="bo-grant-block">
      <BlockHeading
        label={`${block.label} — distribute ${block.dots} dots (${left} left)`}
        done={blockComplete(block, selection)}
      />

      {block.targets.map((target, i) => {
        const dots = selection.alloc[i]
        return (
          <div key={i} className="bo-grant-spread-row">
            <span className="bo-grant-spread-name">{target.name || target.prompt}</span>
            <GhostButton disabled={dots <= 0} onClick={() => set(i, dots - 1)}>
              −
            </GhostButton>
            <span className="bo-grant-spread-dots">{'●'.repeat(dots) || '—'}</span>
            <GhostButton disabled={left <= 0} onClick={() => set(i, dots + 1)}>
              +
            </GhostButton>
            {dots > 0 && needsText(target) ? (
              <input
                type="text"
                className="bo-field bo-grant-text"
                value={selection.texts[i]}
                placeholder={target.prompt || 'Specify…'}
                onChange={(event) =>
                  onChange({ texts: selection.texts.map((s, t) => (t === i ? event.target.value : s)) })
                }
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
