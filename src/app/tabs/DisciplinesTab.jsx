import { useState } from 'react'
import DotTracker from '../components/DotTracker.jsx'
import PowerForm from '../components/PowerForm.jsx'
import {
  SectionTitle,
  LabelledValue,
  Block,
  GhostButton,
  FullRulesButton,
  Modal,
  isEmptyValue
} from '../components/primitives.jsx'
import { readPowerRules } from '../schema/disciplines.js'
import {
  checkAmalgam,
  describeMissing,
  checkPrerequisite,
  describeMissingPowers,
  checkLevel
} from '../schema/requirements.js'
import {
  getAllDisciplines,
  addCustomDiscipline,
  canEditCustomDisciplines
} from '../schema/custom-disciplines.js'
import { promptImport } from '../schema/import.js'
import { rollPower, payPowerCost, powerAction, opposingPoolText } from '../roll/power.js'
import Select from '../components/Select.jsx'
import { disciplineOverview } from '../rules/catalog.js'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']

function powersOf(actor, key) {
  return actor.items
    .filter((item) => item.type === 'power' && item.system.discipline === key)
    .sort((a, b) => (a.system.level ?? 0) - (b.system.level ?? 0) || a.name.localeCompare(b.name))
}

/* ------------------------------------------------------------------ detail */

function PowerDetail({ actor, item, discipline, editable, onEdit, onDelete }) {
  const [showRules, setShowRules] = useState(false)
  const rules = readPowerRules(item)
  const source = item.system.source ?? {}
  const sourceText = source.book ? `${source.book}${source.page ? `, p. ${source.page}` : ''}` : ''

  const action = powerAction(item)
  const amalgamCheck = rules.amalgam ? checkAmalgam(actor, rules.amalgam) : { ok: true, missing: [] }
  const prereqCheck = checkPrerequisite(actor, rules.prerequisite)
  const levelCheck = checkLevel(actor, item)

  const hasLongForm = rules.system || rules.process || rules.ingredients || rules.special || rules.example

  return (
    <div className="bo-panel">
      <div className="bo-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3 className="bo-detail-title">{item.name}</h3>
          <p className="bo-detail-sub">
            {discipline?.label ?? ''} · Level {ROMAN[item.system.level] || item.system.level || '—'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {action === 'roll' ? (
            <GhostButton
              tone="accent"
              title={opposingPoolText(item) ? `Contested — opposed by ${opposingPoolText(item)}` : undefined}
              onClick={() => rollPower(actor, item)}
            >
              Roll
            </GhostButton>
          ) : null}
          {action === 'rouse' ? (
            <GhostButton tone="danger" onClick={() => payPowerCost(actor, item)}>
              Rouse
            </GhostButton>
          ) : null}
          {editable ? (
            <>
              <GhostButton onClick={onEdit}>Edit</GhostButton>
              <button type="button" className="bo-mini" title="Remove this power" onClick={onDelete}>
                ×
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="bo-label">Effect</div>
      <p className="bo-prose is-lead">
        {item.system.description || <span className="bo-value is-empty">No rules text recorded.</span>}
      </p>

      <div className="bo-scalars">
        <LabelledValue label="Cost" value={rules.cost} />
        <LabelledValue label="Prerequisite" value={rules.prerequisite} />
        <LabelledValue label="Amalgam" value={rules.amalgam} />
        <LabelledValue label="Duration" value={rules.duration} />
        <LabelledValue label="Dice pool" value={rules.dicePool} />
        <LabelledValue label="Opposing pool" value={rules.opposingPool} />
      </div>

      {!amalgamCheck.ok ? (
        <p style={{ color: 'var(--bo-accent-red)', fontSize: '15px', marginTop: '14px' }}>
          Requirement not met: {describeMissing(amalgamCheck.missing)}.
        </p>
      ) : null}

      {!levelCheck.ok ? (
        <p style={{ color: 'var(--bo-accent-red)', fontSize: '15px', marginTop: '8px' }}>
          Level {levelCheck.level} power, but {discipline?.label ?? 'the discipline'} is only at{' '}
          {levelCheck.rating}.
        </p>
      ) : null}

      {prereqCheck.status === 'missing' ? (
        <p style={{ color: 'var(--bo-accent-red)', fontSize: '15px', marginTop: '8px' }}>
          Requires {describeMissingPowers(prereqCheck)}.
        </p>
      ) : null}

      {sourceText ? (
        <div className="bo-block">
          <div className="bo-label">Source</div>
          <div className="bo-value" style={{ fontStyle: 'italic', color: 'var(--bo-text-dim)' }}>
            {sourceText}
          </div>
        </div>
      ) : null}

      {hasLongForm ? <FullRulesButton onClick={() => setShowRules(true)} /> : null}

      {showRules ? (
        <Modal
          wide
          title={item.name}
          subtitle={`${discipline?.label ?? ''} · Level ${ROMAN[item.system.level] || item.system.level || '—'}`}
          onClose={() => setShowRules(false)}
        >
          <div className="bo-label">Effect</div>
          <p className="bo-prose is-lead">{item.system.description}</p>

          <div className="bo-scalars">
            <LabelledValue label="Discipline" value={discipline?.label} />
            <LabelledValue label="Amalgam" value={rules.amalgam} />
            <LabelledValue label="Cost" value={rules.cost} />
            <LabelledValue label="Dice pool" value={rules.dicePool} />
            <LabelledValue label="Level" value={item.system.level || ''} />
            <LabelledValue label="Prerequisite" value={rules.prerequisite} />
            <LabelledValue label="Duration" value={rules.duration} />
            <LabelledValue label="Opposing pool" value={rules.opposingPool} />
          </div>

          {rules.system ? <Block label="System">{rules.system}</Block> : null}
          {rules.process ? <Block label="Process">{rules.process}</Block> : null}
          {rules.ingredients ? <Block label="Ingredients">{rules.ingredients}</Block> : null}
          {rules.special ? (
            <Block label="Special" mono>
              {rules.special}
            </Block>
          ) : null}
          {rules.example ? <Block label="Example">{rules.example}</Block> : null}

          {sourceText ? (
            <div className="bo-block">
              <div className="bo-label">Source</div>
              <div className="bo-value" style={{ fontStyle: 'italic', color: 'var(--bo-text-dim)' }}>
                {sourceText}
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  )
}

function DisciplineDetail({ actor, discipline, editable, onAddPower, onRemove }) {
  const powers = powersOf(actor, discipline.id)
  const value = Number(actor.system.disciplines?.[discipline.id]?.value) || 0
  const overview = disciplineOverview(discipline.id)

  return (
    <div className="bo-panel">
      <div className="bo-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3 className="bo-detail-title">{discipline.label}</h3>
          <p className="bo-detail-sub">
            Discipline · Level {ROMAN[value] || value || '—'}
            {discipline.custom ? ' · Custom' : ''}
          </p>
        </div>
      </div>

      {overview?.description ? (
        <>
          <div className="bo-label">Overview</div>
          <p className="bo-prose is-lead">{overview.description}</p>
        </>
      ) : null}

      <div className="bo-scalars">
        <LabelledValue label="Powers known" value={String(powers.length)} />
        <LabelledValue label="Rating" value={String(value)} />
        {overview ? <LabelledValue label="Type" value={overview.type} /> : null}
        {overview ? (
          <LabelledValue label="Masquerade threat" value={overview.masqueradeThreat} />
        ) : null}
        {overview ? <LabelledValue label="Resonance" value={overview.resonance} /> : null}
      </div>

      {editable ? (
        <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
          <GhostButton tone="accent" onClick={() => onAddPower(discipline.id)}>
            + Add power
          </GhostButton>
          <GhostButton tone="danger" onClick={() => onRemove(discipline)}>
            Remove
          </GhostButton>
        </div>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------- tree */

function TreeNode({
  actor,
  discipline,
  editable,
  locked,
  selection,
  onSelectDiscipline,
  onSelectPower,
  onAddPower
}) {
  const key = discipline.id
  const value = Number(actor.system.disciplines?.[key]?.value) || 0
  const powers = powersOf(actor, key)
  const isSelected = selection?.kind === 'discipline' && selection.id === key

  return (
    <div className={isSelected ? 'bo-tree-node is-selected' : 'bo-tree-node'}>
      <div className="bo-row">
        <button
          type="button"
          className={isSelected ? 'bo-trait-name is-selected' : 'bo-trait-name'}
          onClick={() => onSelectDiscipline(key)}
        >
          {discipline.label}
        </button>
        <DotTracker
          value={value}
          disabled={!editable}
          locked={locked}
          onChange={(next) => actor.update({ [`system.disciplines.${key}.value`]: next })}
        />
      </div>

      <div className="bo-tree-powers">
        {powers.map((item) => {
          const rules = readPowerRules(item)
          const check = rules.amalgam ? checkAmalgam(actor, rules.amalgam) : { ok: true, missing: [] }
          const prereq = checkPrerequisite(actor, rules.prerequisite)
          const level = checkLevel(actor, item)
          const blocked = !check.ok || prereq.status === 'missing' || !level.ok
          const selected = selection?.kind === 'power' && selection.id === item.id
          const classes = ['bo-trait-name']
          if (selected) classes.push('is-selected')
          if (blocked) classes.push('is-blocked')

          const reasons = []
          if (!level.ok) reasons.push(`Level ${level.level} power, discipline is only ${level.rating}`)
          if (!check.ok) reasons.push(`Requires ${describeMissing(check.missing)}`)
          if (prereq.status === 'missing') reasons.push(`Requires ${describeMissingPowers(prereq)}`)

          const action = powerAction(item)

          return (
            <div key={item.id} className="bo-row">
              <button
                type="button"
                className={classes.join(' ')}
                title={reasons.length ? reasons.join('; ') : undefined}
                onClick={() => onSelectPower(item.id)}
              >
                {item.name}
                {item.system.level ? (
                  <span style={{ color: 'var(--bo-text-muted)' }}>
                    {' '}
                    {'●'.repeat(item.system.level)}
                  </span>
                ) : null}
              </button>
              {action === 'roll' ? (
                <button
                  type="button"
                  className="bo-mini"
                  title={
                    opposingPoolText(item)
                      ? `Roll ${item.name} — contested by ${opposingPoolText(item)}`
                      : `Roll ${item.name}`
                  }
                  onClick={() => rollPower(actor, item)}
                >
                  ⚀
                </button>
              ) : null}
              {action === 'rouse' ? (
                <button
                  type="button"
                  className="bo-mini"
                  title={`Rouse check for ${item.name}`}
                  onClick={() => payPowerCost(actor, item)}
                >
                  ✦
                </button>
              ) : null}
            </div>
          )
        })}

        {!powers.length ? (
          <span style={{ color: 'var(--bo-text-faint)', fontStyle: 'italic', fontSize: '15px' }}>
            No powers inscribed.
          </span>
        ) : null}

        {editable ? (
          <div>
            <GhostButton onClick={() => onAddPower(key)} style={{ marginTop: '8px' }}>
              + Add power
            </GhostButton>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------- tab */

export default function DisciplinesTab({ actor, editable, locked }) {
  const [selection, setSelection] = useState(null) // { kind: 'discipline'|'power', id }
  const [form, setForm] = useState(null)
  const [pick, setPick] = useState('')
  const [customName, setCustomName] = useState('')
  const [adding, setAdding] = useState(false)

  const all = getAllDisciplines()
  const active = all.filter(
    (d) => Number(actor.system.disciplines?.[d.id]?.value) > 0 || powersOf(actor, d.id).length > 0
  )

  const addExisting = async () => {
    if (!pick) return
    await actor.update({
      [`system.disciplines.${pick}.value`]: 1,
      [`system.disciplines.${pick}.visible`]: true
    })
    setPick('')
    setAdding(false)
  }

  const addCustom = async () => {
    const name = customName.trim()
    if (!name) return
    if (!canEditCustomDisciplines()) {
      ui.notifications.warn('Only a GM can create a custom discipline, since it is a world setting.')
      return
    }
    const entry = await addCustomDiscipline(name)
    if (!entry) return
    await actor.update({
      [`system.disciplines.${entry.id}.value`]: 1,
      [`system.disciplines.${entry.id}.visible`]: true
    })
    setCustomName('')
    setAdding(false)
  }

  const removeDiscipline = async (discipline) => {
    const powers = powersOf(actor, discipline.id)
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      classes: ['blood-oracle', 'bo-dialog'],
      window: { title: 'Remove discipline' },
      content:
        `<p>Remove <strong>${foundry.utils.escapeHTML(discipline.label)}</strong> from this character` +
        (powers.length ? `, along with ${powers.length} power(s)` : '') +
        '?</p>' +
        (discipline.custom ? '<p>The custom discipline itself stays defined for the world.</p>' : '')
    })
    if (!confirmed) return

    if (powers.length) {
      await actor.deleteEmbeddedDocuments('Item', powers.map((p) => p.id))
    }
    await actor.update({ [`system.disciplines.${discipline.id}.value`]: 0 })
    setSelection(null)
  }

  const deletePower = async (item) => {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      classes: ['blood-oracle', 'bo-dialog'],
      window: { title: 'Delete power' },
      content: `<p>Delete <strong>${foundry.utils.escapeHTML(item.name)}</strong> from this character?</p>`
    })
    if (!confirmed) return
    setSelection(null)
    await item.delete()
  }

  // Resolve the selection, tolerating something that was just deleted.
  let detail = null
  if (selection?.kind === 'power') {
    const item = actor.items.get(selection.id)
    if (item) {
      detail = (
        <PowerDetail
          actor={actor}
          item={item}
          discipline={all.find((d) => d.id === item.system.discipline)}
          editable={editable}
          onEdit={() => setForm({ disciplineKey: item.system.discipline, item })}
          onDelete={() => deletePower(item)}
        />
      )
    }
  } else if (selection?.kind === 'discipline') {
    const discipline = all.find((d) => d.id === selection.id)
    if (discipline) {
      detail = (
        <DisciplineDetail
          actor={actor}
          discipline={discipline}
          editable={editable}
          onAddPower={(key) => setForm({ disciplineKey: key })}
          onRemove={removeDiscipline}
        />
      )
    }
  }

  return (
    <div>
      <SectionTitle
        info="Pick a discipline, set its level, then add powers up to that level. Powers cannot exceed the Discipline's rating. An Amalgam also requires dots in a second Discipline. Rituals and Ceremonies are kept here too, under their own headings."
        actions={
          editable ? (
            <>
              <GhostButton tone="accent" onClick={() => setAdding((v) => !v)}>
                {adding ? 'Close' : '+ Add discipline'}
              </GhostButton>
              <GhostButton onClick={() => promptImport(actor)}>Import</GhostButton>
            </>
          ) : null
        }
      >
        Disciplines
      </SectionTitle>

      {adding ? (
        <div className="bo-panel" style={{ display: 'grid', gap: '13px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <label className="bo-field-label" style={{ flex: 1 }}>
              <span>Existing discipline</span>
              <Select
                value={pick}
                placeholder="Choose discipline…"
                options={all.map((d) => {
                  const taken = active.some((a) => a.id === d.id)
                  return {
                    value: d.id,
                    label: d.label,
                    disabled: taken,
                    hint: taken ? 'already chosen' : d.custom ? 'custom' : undefined
                  }
                })}
                onChange={setPick}
              />
            </label>
            <GhostButton tone="accent" onClick={addExisting} disabled={!pick}>
              Add
            </GhostButton>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <label className="bo-field-label" style={{ flex: 1 }}>
              <span>Or inscribe a new one</span>
              <input
                type="text"
                className="bo-field"
                value={customName}
                placeholder="Name of the homebrew discipline"
                onChange={(e) => setCustomName(e.target.value)}
              />
            </label>
            <GhostButton tone="accent" onClick={addCustom} disabled={!customName.trim()}>
              Create
            </GhostButton>
          </div>

          <p style={{ color: 'var(--bo-text-faint)', fontSize: '14px', margin: 0 }}>
            A new discipline is registered with the system, so it becomes available to every
            character in this world and works on the wod5e sheet as well. Creating one requires GM
            rights.
          </p>
        </div>
      ) : null}

      <div className="bo-master-detail">
        <div>
          {active.length ? (
            active.map((discipline) => (
              <TreeNode
                key={discipline.id}
                actor={actor}
                discipline={discipline}
                editable={editable}
                locked={locked}
                selection={selection}
                onSelectDiscipline={(id) =>
                  setSelection((prev) =>
                    prev?.kind === 'discipline' && prev.id === id ? null : { kind: 'discipline', id }
                  )
                }
                onSelectPower={(id) =>
                  setSelection((prev) =>
                    prev?.kind === 'power' && prev.id === id ? null : { kind: 'power', id }
                  )
                }
                onAddPower={(key) => setForm({ disciplineKey: key })}
              />
            ))
          ) : (
            <p className="bo-empty">The Blood has yet to whisper its secrets…</p>
          )}
        </div>

        <div>
          {detail ?? (
            <div className="bo-panel">
              <p className="bo-empty" style={{ padding: '28px 0' }}>
                Select a discipline or power on the left to view its details.
              </p>
            </div>
          )}
        </div>
      </div>

      {form ? (
        <PowerForm
          actor={actor}
          disciplineKey={form.disciplineKey}
          item={form.item}
          onClose={() => setForm(null)}
        />
      ) : null}
    </div>
  )
}
