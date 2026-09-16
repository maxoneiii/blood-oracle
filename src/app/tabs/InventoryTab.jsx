import { useState } from 'react'
import { SectionTitle, LabelledValue, GhostButton } from '../components/primitives.jsx'
import {
  SECTIONS,
  GEAR_PLACES,
  ARMOR_VALUES,
  WEAPON_TYPES,
  gearPlace,
  setGearPlace,
  itemsOfSection,
  isEquipped,
  setEquipped,
  armorRating,
  setArmorRating,
  buildItemData
} from '../schema/inventory.js'

function Detail({ item, editable, onDelete }) {
  const section = item.type
  const rating = armorRating(item)

  return (
    <div className="bo-panel">
      <div className="bo-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3 className="bo-detail-title">{item.name}</h3>
          <p className="bo-detail-sub">
            {section}
            {isEquipped(item) ? ' · equipped' : ''}
          </p>
        </div>
        {editable ? (
          <GhostButton tone="danger" onClick={onDelete}>
            Remove
          </GhostButton>
        ) : null}
      </div>

      <div className="bo-form-grid" style={{ marginBottom: '14px' }}>
        <label className="bo-field-label">
          <span>Name</span>
          <input
            type="text"
            className="bo-field"
            defaultValue={item.name}
            disabled={!editable}
            onBlur={(event) => item.update({ name: event.target.value })}
            key={item.name}
          />
        </label>

        <label className="bo-field-label">
          <span>Quantity</span>
          <input
            type="number"
            className="bo-field"
            min={1}
            defaultValue={item.system.quantity ?? 1}
            disabled={!editable}
            onBlur={(event) =>
              item.update({ 'system.quantity': parseInt(event.target.value, 10) || 1 })
            }
            key={item.system.quantity}
          />
        </label>

        {section === 'weapon' ? (
          <>
            <label className="bo-field-label">
              <span>Type</span>
              <select
                className="bo-field"
                value={item.system.weaponType ?? 'melee'}
                disabled={!editable}
                onChange={(event) => item.update({ 'system.weaponType': event.target.value })}
              >
                {WEAPON_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="bo-field-label">
              <span>Damage bonus</span>
              <select
                className="bo-field"
                value={item.system.weaponvalue ?? 0}
                disabled={!editable}
                onChange={(event) =>
                  item.update({ 'system.weaponvalue': parseInt(event.target.value, 10) || 0 })
                }
              >
                {[0, 1, 2, 3, 4].map((value) => (
                  <option key={value} value={value}>
                    +{value}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        {section === 'gear' ? (
          <label className="bo-field-label">
            <span>Kept</span>
            <select
              className="bo-field"
              value={gearPlace(item)}
              disabled={!editable}
              onChange={(event) => setGearPlace(item, event.target.value)}
            >
              <option value={GEAR_PLACES.carried}>On their person</option>
              <option value={GEAR_PLACES.property}>Elsewhere</option>
            </select>
          </label>
        ) : null}

        {section === 'armor' ? (
          <label className="bo-field-label" style={{ gridColumn: '1 / -1' }}>
            <span>Rating</span>
            <select
              className="bo-field"
              value={item.getFlag('blood-oracle', 'armorRating') ?? ''}
              disabled={!editable}
              onChange={(event) => setArmorRating(item, event.target.value)}
            >
              <option value="">—</option>
              {ARMOR_VALUES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <label className="bo-field-label" style={{ marginBottom: '14px' }}>
        <span>Notes</span>
        <textarea
          className="bo-field"
          rows={4}
          style={{ resize: 'vertical' }}
          defaultValue={item.system.description ?? ''}
          disabled={!editable}
          placeholder={
            SECTIONS.find(
              (entry) =>
                entry.id === section && (!entry.place || entry.place === gearPlace(item))
            )?.placeholder
          }
          onBlur={(event) => item.update({ 'system.description': event.target.value })}
          key={item.system.description}
        />
      </label>

      {rating ? (
        <div className="bo-scalars">
          <LabelledValue label="Armour dice" value={String(rating.dice)} />
          <LabelledValue
            label="Against bullets"
            value={rating.vsBullets !== undefined ? String(rating.vsBullets) : String(rating.dice)}
          />
          <LabelledValue
            label="Dexterity penalty"
            value={rating.dexPenalty ? `−${rating.dexPenalty}` : '—'}
          />
        </div>
      ) : null}
    </div>
  )
}

export default function InventoryTab({ actor, editable }) {
  const [selectedId, setSelectedId] = useState(null)
  const selected = selectedId ? actor.items.get(selectedId) : null

  const add = async (section) => {
    const [created] = await actor.createEmbeddedDocuments('Item', [buildItemData(section)])
    if (created) setSelectedId(created.id)
  }

  const remove = async (item) => {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      classes: ['blood-oracle', 'bo-dialog'],
      window: { title: 'Remove item' },
      content: `<p>Remove <strong>${foundry.utils.escapeHTML(item.name)}</strong> from this character?</p>`
    })
    if (!confirmed) return
    setSelectedId(null)
    await item.delete()
  }

  return (
    <div>
      <SectionTitle
        info="Only equipped weapons add damage, and only equipped heavy armour costs Dexterity. Weapon damage is a flat bonus to successes, not extra dice, so it is shown apart from the pool. Brawl is unarmed and never draws an equipped weapon.">
        Inventory
      </SectionTitle>

      <div className="bo-master-detail">
        <div>
          {SECTIONS.map((section) => {
            const items = itemsOfSection(actor, section)

            return (
              <div key={section.label} style={{ marginBottom: '22px' }}>
                <div className="bo-row" style={{ marginBottom: '10px' }}>
                  <div className="bo-label" style={{ margin: 0 }}>
                    {section.label}
                  </div>
                  {editable ? (
                    <GhostButton tone="accent" onClick={() => add(section)}>
                      + Add
                    </GhostButton>
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
                          {(item.system.quantity ?? 1) > 1 ? (
                            <span style={{ color: 'var(--bo-text-muted)', marginLeft: '6px' }}>
                              ×{item.system.quantity}
                            </span>
                          ) : null}
                          {item.type === 'weapon' && item.system.weaponvalue ? (
                            <span className="bo-specialty">(+{item.system.weaponvalue})</span>
                          ) : null}
                        </div>

                        {section.place === GEAR_PLACES.property ? null : (
                          <label className="bo-equip" title="Equipped">
                            <input
                              type="checkbox"
                              checked={isEquipped(item)}
                              disabled={!editable}
                              onChange={(event) => setEquipped(item, event.target.checked)}
                            />
                            <span>equipped</span>
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="bo-empty" style={{ textAlign: 'left', padding: '4px 0' }}>
                    Nothing carried.
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div>
          {selected ? (
            <Detail item={selected} editable={editable} onDelete={() => remove(selected)} />
          ) : (
            <div className="bo-panel">
              <p className="bo-empty" style={{ padding: '28px 0' }}>
                Select an item on the left to view its details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
