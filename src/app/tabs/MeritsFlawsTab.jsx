import { useState } from 'react'
import DotTracker from '../components/DotTracker.jsx'
import { SectionTitle, LabelledValue, GhostButton } from '../components/primitives.jsx'
import { isLoaded } from '../rules/catalog.js'
import AdvantagePicker from '../components/AdvantagePicker.jsx'
import {
  FEATURE_TYPES,
  featuresOfType,
  readAdvantageMeta,
  addFeature,
  setDetails,
  dotsRange
} from '../schema/advantages.js'
import { featureOrigin } from '../schema/predator-grants.js'

const SECTIONS = [
  { type: FEATURE_TYPES.merit, title: 'Merits', kind: 'merit' },
  { type: FEATURE_TYPES.flaw, title: 'Flaws', kind: 'flaw' },
  { type: FEATURE_TYPES.background, title: 'Backgrounds', kind: 'merit' }
]

/* ------------------------------------------------------------- detail */

function FeatureDetail({ item, editable, locked, onDelete }) {
  const meta = readAdvantageMeta(item)
  const origin = item.parent ? featureOrigin(item.parent, item.id) : null
  const range = dotsRange(meta.dots)

  return (
    <div className="bo-panel">
      <div className="bo-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3 className="bo-detail-title">{item.name}</h3>
          <p className="bo-detail-sub">
            {meta.group ? `${meta.group} · ` : ''}
            {item.system.featuretype}
            {origin ? ` · granted by ${origin}` : ''}
          </p>
        </div>
        {editable ? (
          <GhostButton tone="danger" onClick={onDelete}>
            Remove
          </GhostButton>
        ) : null}
      </div>

      <div className="bo-row" style={{ margin: '4px 0 14px' }}>
        <span style={{ color: 'var(--bo-text-muted)', fontSize: '15px' }}>
          Rating
          {range.fixed ? (
            <span style={{ color: 'var(--bo-text-faint)', marginLeft: '6px' }}>· fixed</span>
          ) : null}
        </span>
        <DotTracker
          value={item.system.points ?? 0}
          max={Math.min(Math.max(range.max, 1), 6)}
          min={range.min}
          // A fixed-price merit costs what it costs; only ranges are a choice.
          disabled={!editable || range.fixed}
          locked={locked}
          onChange={(next) =>
            item.update({ 'system.points': Math.max(range.min, Math.min(range.max, next)) })
          }
        />
      </div>

      {item.system.description ? (
        <p className="bo-prose">{item.system.description}</p>
      ) : (
        <p className="bo-value is-empty">No description recorded.</p>
      )}

      {meta.hasDetails ? (
        <label className="bo-field-label" style={{ marginTop: '14px' }}>
          <span>Details</span>
          <input
            type="text"
            className="bo-field"
            defaultValue={meta.details ?? ''}
            disabled={!editable}
            placeholder={meta.detailsPlaceholder || 'Specifics…'}
            onBlur={(event) => setDetails(item, event.target.value)}
            key={meta.details ?? ''}
          />
        </label>
      ) : null}

      {meta.dots ? (
        <div className="bo-scalars">
          <LabelledValue label="Rating in the book" value={meta.bookDots ?? meta.dots} />
        </div>
      ) : null}
    </div>
  )
}

/* ---------------------------------------------------------------- tab */

export default function MeritsFlawsTab({ actor, editable, locked }) {
  const [selectedId, setSelectedId] = useState(null)
  const [picking, setPicking] = useState(null) // { kind, backgroundsOnly, type }

  const selected = selectedId ? actor.items.get(selectedId) : null

  const remove = async (item) => {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      classes: ['blood-oracle', 'bo-dialog'],
      window: { title: 'Remove feature' },
      content: `<p>Remove <strong>${foundry.utils.escapeHTML(item.name)}</strong> from this character?</p>`
    })
    if (!confirmed) return
    setSelectedId(null)
    await item.delete()
  }

  const addBlank = async (featuretype) => {
    const created = await addFeature(actor, { featuretype })
    if (created) setSelectedId(created.id)
  }

  const pickFrom = async (entry) => {
    const created = await addFeature(actor, { entry })
    setPicking(null)
    if (created) setSelectedId(created.id)
  }

  return (
    <div>
      <SectionTitle
        info="What the character carries beyond their traits — and what carries them. The rating shown beside a catalogue entry is the range the book allows, not the rating bought. Set the dots to what the character actually has.">
        Merits &amp; flaws
      </SectionTitle>

      <div className="bo-master-detail">
        <div>
          {SECTIONS.map((section) => {
            const items = featuresOfType(actor, section.type)

            return (
              <div key={section.type} style={{ marginBottom: '22px' }}>
                <div className="bo-row" style={{ marginBottom: '10px' }}>
                  <div className="bo-label" style={{ margin: 0 }}>
                    {section.title}
                  </div>
                  {editable ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {isLoaded() ? (
                        <GhostButton
                          tone="accent"
                          onClick={() =>
                            setPicking({
                              kind: section.kind,
                              backgroundsOnly: section.type === FEATURE_TYPES.background,
                              type: section.type
                            })
                          }
                        >
                          + Add
                        </GhostButton>
                      ) : null}
                      <GhostButton onClick={() => addBlank(section.type)}>Custom</GhostButton>
                    </div>
                  ) : null}
                </div>

                {items.length ? (
                  <div style={{ display: 'grid', gap: '4px' }}>
                    {items.map((item) => (
                      <div key={item.id} className="bo-stat-row">
                        <div className="bo-stat-name">
                          <button
                            type="button"
                            className={
                              selectedId === item.id ? 'bo-trait-name is-selected' : 'bo-trait-name'
                            }
                            onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                          >
                            {item.name}
                          </button>
                          {readAdvantageMeta(item).details ? (
                            <span className="bo-specialty">({readAdvantageMeta(item).details})</span>
                          ) : null}
                          {featureOrigin(actor, item.id) ? (
                            <span
                              className="bo-origin"
                              title={`Granted by predator type: ${featureOrigin(actor, item.id)}`}
                            >
                              pred
                            </span>
                          ) : null}
                        </div>
                        {(() => {
                          const range = dotsRange(readAdvantageMeta(item).dots)
                          return (
                            <DotTracker
                              value={item.system.points ?? 0}
                              max={Math.min(Math.max(range.max, 1), 6)}
                              min={range.min}
                              disabled={!editable || range.fixed}
                              locked={locked}
                              onChange={(next) =>
                                item.update({
                                  'system.points': Math.max(range.min, Math.min(range.max, next))
                                })
                              }
                            />
                          )
                        })()}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="bo-empty" style={{ textAlign: 'left', padding: '4px 0' }}>
                    {section.type === FEATURE_TYPES.flaw
                      ? 'Nothing weighs on them yet.'
                      : 'Nothing recorded yet.'}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div>
          {selected ? (
            <FeatureDetail
              item={selected}
              editable={editable}
              locked={locked}
              onDelete={() => remove(selected)}
            />
          ) : (
            <div className="bo-panel">
              <p className="bo-empty" style={{ padding: '28px 0' }}>
                Select an entry on the left to view its details.
              </p>
            </div>
          )}
        </div>
      </div>

      {picking ? (
        <AdvantagePicker
          actor={actor}
          kind={picking.kind}
          sectionType={picking.type}
          backgroundsOnly={picking.backgroundsOnly}
          onPick={pickFrom}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </div>
  )
}
