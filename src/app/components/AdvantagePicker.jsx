import { useMemo, useState } from 'react'
import { Modal, GhostButton } from './primitives.jsx'
import { searchAdvantages } from '../rules/catalog.js'
import { featuresOfType } from '../schema/advantages.js'
import { readSingletonName } from '../schema/singletons.js'

/**
 * Choosing a merit, flaw or background from the reference.
 *
 * Three columns: rubrics, the entries of the chosen rubric, and a preview of
 * the entry under the pointer. Search ignores the rubric and looks everywhere.
 * Hovering previews, clicking fixes the preview, Add (or a double click) adds.
 */

const ALL = '__all__'

/** Common groups first, the exotic later, the ones for other kinds of character last. */
const ORDER = {
  merit: [
    'Feeding', 'Looks', 'Psychological', 'Bonding', 'Linguistics', 'Substance Use',
    'Blood Ties', 'Other', 'Mythic', 'Archaic', 'Cults', 'Caitiff', 'Thin-Blood', 'Ghoul'
  ],
  flaw: [
    'Feeding', 'Backgrounds', 'Psychological', 'Bonding', 'Looks', 'Substance Use',
    'Linguistics', 'Supernatural', 'Blood Ties', 'Other', 'Contagion', 'Diablerie',
    'Ingrained Discipline', 'Mythic', 'Archaic', 'Cults', 'Caitiff', 'Thin-Blood', 'Ghoul'
  ]
}

/** Groups that only some characters can take, and the test for who can. */
const RESTRICTED = {
  'Thin-Blood': (ctx) => ctx.clan.includes('thin'),
  Caitiff: (ctx) => ctx.clan.includes('caitiff'),
  Ghoul: (ctx) => ctx.type === 'ghoul'
}

function groupLabel(kind, group) {
  if (kind === 'flaw' && group === 'Backgrounds') return 'Background flaws'
  return group
}

function rank(kind, group) {
  const index = ORDER[kind].indexOf(group)
  return index === -1 ? ORDER[kind].indexOf('Other') + 0.5 : index
}

const norm = (value) => String(value ?? '').trim().toLowerCase()

/** An entry with details (Allies, Linguistics, Enemy) can be taken more than once. */
const repeatable = (entry) => entry.hasDetails || /\bper\b/i.test(entry.dots)

export default function AdvantagePicker({ actor, kind, sectionType, backgroundsOnly, onPick, onClose }) {
  const [rubric, setRubric] = useState(ALL)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [showAll, setShowAll] = useState(false)

  const ctx = {
    type: actor.type,
    clan: norm(readSingletonName(actor, 'clan'))
  }
  // A story character can stand in for anything, so nothing is held back.
  const allowed = (group) => actor.type === 'spc' || showAll || !RESTRICTED[group] || RESTRICTED[group](ctx)

  const owned = useMemo(
    () => new Set(featuresOfType(actor, sectionType).map((item) => norm(item.name))),
    [actor, sectionType, actor.items.size]
  )

  const pool = useMemo(() => {
    const all = searchAdvantages('', { kind, limit: 1000 })
    // Positive backgrounds have their own section; background flaws are flaws.
    if (backgroundsOnly) return all.filter((entry) => entry.group === 'Backgrounds')
    return kind === 'merit' ? all.filter((entry) => entry.group !== 'Backgrounds') : all
  }, [kind, backgroundsOnly])

  const visible = pool.filter((entry) => allowed(entry.group))

  const groups = useMemo(() => {
    const counts = new Map()
    for (const entry of visible) counts.set(entry.group, (counts.get(entry.group) ?? 0) + 1)
    return [...counts.entries()].sort(
      ([a], [b]) => rank(kind, a) - rank(kind, b) || a.localeCompare(b)
    )
  }, [visible, kind])

  const searching = Boolean(query.trim())
  const needle = norm(query)
  const entries = (searching
    ? visible.filter((entry) => norm(entry.name).includes(needle) || norm(entry.group).includes(needle))
    : rubric === ALL
      ? visible
      : visible.filter((entry) => entry.group === rubric)
  ).sort((a, b) => rank(kind, a.group) - rank(kind, b.group) || a.name.localeCompare(b.name))

  const showGroup = searching || rubric === ALL
  const isTaken = (entry) => owned.has(norm(entry.name))
  const canAdd = (entry) => !isTaken(entry) || repeatable(entry)
  const preview = hovered ?? selected

  const add = (entry) => {
    if (entry && canAdd(entry)) onPick(entry)
  }

  const hiddenGroups = pool.some((entry) => RESTRICTED[entry.group] && !RESTRICTED[entry.group](ctx))
  const single = backgroundsOnly || groups.length <= 1
  const title = backgroundsOnly ? 'Choose a background' : kind === 'flaw' ? 'Choose a flaw' : 'Choose a merit'

  return (
    <Modal title={title} className="bo-modal is-xwide" onClose={onClose}>
      <input
        type="text"
        className="bo-field"
        value={query}
        autoFocus
        placeholder={single ? 'Search…' : 'Search every group…'}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className={single ? 'bo-picker is-single' : 'bo-picker'}>
        {single ? null : (
          <ul className="bo-picker-rubrics">
            <RubricRow label="All" count={visible.length} active={!searching && rubric === ALL} onClick={() => { setRubric(ALL); setQuery('') }} />
            {groups.map(([group, count]) => (
              <RubricRow
                key={group}
                label={groupLabel(kind, group)}
                count={count}
                active={!searching && rubric === group}
                onClick={() => {
                  setRubric(group)
                  setQuery('')
                }}
              />
            ))}
          </ul>
        )}

        <ul className="bo-picker-list" onMouseLeave={() => setHovered(null)}>
          {searching ? <li className="bo-picker-note">Results in every group</li> : null}
          {entries.map((entry) => {
            const taken = isTaken(entry)
            const classes = [
              'bo-catalog-item',
              taken && !repeatable(entry) ? 'is-owned' : '',
              selected === entry ? 'is-selected' : ''
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <li key={`${entry.group}-${entry.name}`}>
                <button
                  type="button"
                  className={classes}
                  onMouseEnter={() => setHovered(entry)}
                  onClick={() => setSelected(entry)}
                  onDoubleClick={() => add(entry)}
                >
                  <span>
                    {taken ? <span className="bo-picker-check">✓ </span> : null}
                    {entry.name}
                    {showGroup ? (
                      <span className="bo-catalog-meta" style={{ marginLeft: '8px' }}>
                        {groupLabel(kind, entry.group)}
                      </span>
                    ) : null}
                  </span>
                  <span className="bo-catalog-meta">{entry.dots}</span>
                </button>
              </li>
            )
          })}
          {!entries.length ? <li className="bo-picker-note">Nothing in the reference matches that.</li> : null}
        </ul>

        <div className="bo-picker-preview">
          {preview ? (
            <>
              <h3 className="bo-detail-title">{preview.name}</h3>
              <p className="bo-detail-sub">
                {groupLabel(kind, preview.group)} · {preview.dots || '—'} {preview.dots === '1' ? 'dot' : 'dots'}
              </p>
              <p className="bo-prose">{preview.description || 'No description recorded.'}</p>
              {isTaken(preview) ? (
                <p className="bo-picker-note">
                  {repeatable(preview) ? '✓ Already taken — can be taken again' : '✓ Already taken'}
                </p>
              ) : null}
              <GhostButton tone="accent" disabled={!canAdd(preview)} onClick={() => add(preview)}>
                Add
              </GhostButton>
            </>
          ) : (
            <p className="bo-picker-note">Point at an entry to read it.</p>
          )}
        </div>
      </div>

      {hiddenGroups && actor.type !== 'spc' ? (
        <label className="bo-picker-toggle">
          <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
          Show groups for other kinds of character
        </label>
      ) : null}
    </Modal>
  )
}

function RubricRow({ label, count, active, onClick }) {
  return (
    <li>
      <button type="button" className={active ? 'bo-picker-rubric is-active' : 'bo-picker-rubric'} onClick={onClick}>
        <span>{label}</span>
        <span className="bo-catalog-meta">{count}</span>
      </button>
    </li>
  )
}
