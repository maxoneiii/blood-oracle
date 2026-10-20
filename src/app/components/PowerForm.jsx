import { useState } from 'react'
import { Modal, GhostButton } from './primitives.jsx'
import CatalogPicker from './CatalogPicker.jsx'
import { MODULE_ID } from '../../constants.js'
import { parseRouseCost, parseDicePool, splitSource, RULE_FLAG_FIELDS } from '../schema/disciplines.js'

const TEXT_FIELDS = [
  ['effect', 'Effect', true],
  ['cost', 'Cost', false],
  ['dicePool', 'Dice pool', false],
  ['opposingPool', 'Opposing pool', false],
  ['amalgam', 'Amalgam', false],
  ['prerequisite', 'Prerequisite', false],
  ['duration', 'Duration', false],
  ['system', 'System', true],
  ['process', 'Process', true],
  ['ingredients', 'Ingredients', false],
  ['special', 'Special', true],
  ['example', 'Example', true],
  ['source', 'Source', false]
]

function draftFromItem(item) {
  const rules = item.getFlag(MODULE_ID, 'rules') ?? {}
  const source = item.system.source ?? {}
  return {
    name: item.name,
    level: item.system.level ?? 1,
    effect: item.system.description ?? '',
    source: source.book ? `${source.book}${source.page ? `, page ${source.page}` : ''}` : '',
    ...rules
  }
}

export default function PowerForm({ actor, disciplineKey, item, onClose }) {
  const [draft, setDraft] = useState(() => (item ? draftFromItem(item) : { name: '', level: 1 }))
  const [busy, setBusy] = useState(false)

  const set = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }))

  // Fill the form from a reference entry. Everything stays editable after,
  // so this is a shortcut and not a lock-in.
  const applyEntry = (entry) => {
    setDraft({
      name: entry.name,
      level: entry.level || 1,
      effect: entry.effect ?? '',
      cost: entry.cost ?? '',
      dicePool: entry.dicePool ?? '',
      opposingPool: entry.opposingPool ?? '',
      amalgam: entry.amalgam ?? '',
      prerequisite: entry.prerequisite ?? '',
      duration: entry.duration ?? '',
      system: entry.system ?? '',
      process: entry.process ?? '',
      ingredients: entry.ingredients ?? '',
      special: entry.special ?? '',
      example: entry.example ?? '',
      source: entry.source ?? ''
    })
  }

  const ownedNames = actor.items
    .filter((existing) => existing.type === 'power' && existing.system.discipline === disciplineKey)
    .filter((existing) => existing.id !== item?.id)
    .map((existing) => existing.name)

  const save = async () => {
    const name = String(draft.name ?? '').trim()
    if (!name) {
      ui.notifications.warn('The power needs a name.')
      return
    }

    const rules = {}
    for (const field of RULE_FLAG_FIELDS) {
      if (draft[field]) rules[field] = draft[field]
    }

    const payload = {
      name,
      type: 'power',
      system: {
        discipline: disciplineKey,
        level: Number(draft.level) || 0,
        // Rouse cost is a number in the system; the wording stays in flags.
        cost: parseRouseCost(draft.cost),
        description: draft.effect ?? '',
        dicepool: parseDicePool(draft.dicePool),
        source: splitSource(draft.source)
      },
      flags: { [MODULE_ID]: { rules } }
    }

    setBusy(true)
    try {
      if (item) await item.update(payload)
      else await actor.createEmbeddedDocuments('Item', [payload])
      onClose()
    } catch (error) {
      console.error('Blood Oracle | Could not save power', error)
      ui.notifications.error('The power could not be saved. See the console for details.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal wide title={item ? 'Edit power' : 'Inscribe a power'} onClose={onClose}>
      <CatalogPicker actor={actor} discipline={disciplineKey} onPick={applyEntry} ownedNames={ownedNames} />

      <div style={{ display: 'flex', gap: '12px', margin: '14px 0 13px' }}>
        <label className="bo-field-label" style={{ flex: 3 }}>
          <span>Name</span>
          <input
            type="text"
            className="bo-field"
            value={draft.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>
        <label className="bo-field-label" style={{ flex: 1 }}>
          <span>Level</span>
          <input
            type="number"
            className="bo-field"
            min={1}
            max={5}
            value={draft.level ?? 1}
            onChange={(e) => set('level', parseInt(e.target.value, 10) || 1)}
          />
        </label>
      </div>

      {TEXT_FIELDS.map(([key, label, multiline]) => (
        <label key={key} className="bo-field-label" style={{ marginBottom: '11px' }}>
          <span>{label}</span>
          {multiline ? (
            <textarea
              className="bo-field"
              rows={3}
              style={{ resize: 'vertical' }}
              value={draft[key] ?? ''}
              onChange={(e) => set(key, e.target.value)}
            />
          ) : (
            <input
              type="text"
              className="bo-field"
              value={draft[key] ?? ''}
              onChange={(e) => set(key, e.target.value)}
            />
          )}
        </label>
      ))}

      <p style={{ color: 'var(--bo-text-faint)', fontSize: '14px', margin: '4px 0 18px' }}>
        Cost is also read as a number of Rouse checks, and the dice pool is matched against traits
        where possible, so the power works with the system's own rolls.
      </p>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <button type="button" className="bo-solid" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  )
}
