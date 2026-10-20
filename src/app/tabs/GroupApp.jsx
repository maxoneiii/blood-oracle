import { useState } from 'react'
import DotTracker from '../components/DotTracker.jsx'
import RichText from '../components/RichText.jsx'
import { SectionTitle, GhostButton, Modal } from '../components/primitives.jsx'
import {
  GEAR_PLACES,
  itemsOfSection,
  buildItemData,
  gearPlace
} from '../schema/inventory.js'
import EditableText from '../components/EditableText.jsx'
import { warnLocked } from '../lock.js'
import Select from '../components/Select.jsx'

/**
 * Groups: a coterie of Kindred, a pack of Garou, a cell of hunters.
 *
 * wod5e already models all three on one actor type, with a `groupType` picking
 * which set of ratings applies. We follow that rather than inventing anything:
 * the domain a coterie shares is Chasse, Lien and Portillon, and those are real
 * fields on the actor.
 */

const GROUP_TYPES = [
  { id: 'coterie', label: 'Coterie' },
  { id: 'pack', label: 'Pack' },
  { id: 'cell', label: 'Cell' }
]

const RATINGS = {
  coterie: [
    {
      id: 'chasse',
      label: 'Chasse',
      path: 'system.chasse.value',
      info: 'The hunting ground itself — how rich the feeding is, and how many mortals move through it. High Chasse feeds the coterie; it also draws attention.'
    },
    {
      id: 'lien',
      label: 'Lien',
      path: 'system.lien.value',
      info: 'How closely the domain is tied to its mortal population — contacts, influence, the sense of belonging there. Lien is what makes a domain home rather than a feeding pen.'
    },
    {
      id: 'portillon',
      label: 'Portillon',
      path: 'system.portillon.value',
      info: 'How well the domain is secured against intrusion: wards, watchers, locked doors and the loyalty of those who hold the keys.'
    }
  ],
  pack: [
    { id: 'territory', label: 'Territory', path: 'system.territory.value' },
    { id: 'community', label: 'Community', path: 'system.community.value' },
    { id: 'spirit', label: 'Spirit', path: 'system.spirit.value' }
  ],
  cell: [
    { id: 'desperation', label: 'Desperation', path: 'system.desperation.value' },
    { id: 'danger', label: 'Danger', path: 'system.danger.value' }
  ]
}

/* ---------------------------------------------------------------- members */

/**
 * Membership is stored as UUIDs, not raw ids — the system resolves them with
 * `fromUuidSync` and warns to the console when it cannot. It also keeps a
 * back-reference on the member (`system.group`) and refuses anyone already in
 * another group, so adding and removing both have to do more than edit an array.
 */
function MemberPicker({ actor, taken, onClose }) {
  const [query, setQuery] = useState('')

  // Built from a plain array rather than the collection's own helpers, so a
  // difference in Foundry's Collection API cannot take the sheet down with it.
  const needle = query.trim().toLowerCase()
  const candidates = Array.from(game.actors ?? [])
    .filter(
      (entry) =>
        entry?.uuid &&
        entry.type !== 'group' &&
        entry.id !== actor.id &&
        !taken.includes(entry.uuid) &&
        String(entry.name ?? '').toLowerCase().includes(needle)
    )
    .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))

  const add = async (member) => {
    try {
      const existingGroupId = member.system?.group
      const existingGroup = existingGroupId ? game.actors.get(existingGroupId) : null

      if (existingGroup && existingGroup.id !== actor.id) {
        ui.notifications.warn(`${member.name} already belongs to ${existingGroup.name}.`)
        return
      }

      await actor.update({ 'system.members': [...taken, member.uuid] })
      // The back-reference the system relies on to spot double membership.
      await member.update({ 'system.group': actor.id })
    } catch (error) {
      console.error('Blood Oracle | Could not add member', error)
      ui.notifications.error('Could not add that member — see the console for details.')
    }
    onClose()
  }

  return (
    <Modal title="Add member" onClose={onClose}>
      <label className="bo-field-label" style={{ marginBottom: '12px' }}>
        <span>Search</span>
        <input
          type="text"
          className="bo-field"
          value={query}
          autoFocus
          placeholder="Name…"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <ul className="bo-catalog-list" style={{ maxHeight: '320px' }}>
        {candidates.map((entry) => (
          <li key={entry.uuid}>
            <button type="button" className="bo-catalog-item" onClick={() => add(entry)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {entry.img ? (
                  <img src={entry.img} alt="" className="bo-catalog-thumb" />
                ) : null}
                {entry.name}
              </span>
              <span className="bo-catalog-meta">{entry.type}</span>
            </button>
          </li>
        ))}
        {!candidates.length ? (
          <li style={{ padding: '10px 12px', color: 'var(--bo-text-faint)', fontStyle: 'italic' }}>
            No one left to add.
          </li>
        ) : null}
      </ul>
    </Modal>
  )
}

function Members({ actor, editable }) {
  const [picking, setPicking] = useState(false)
  const uuids = Array.isArray(actor.system.members) ? actor.system.members : []
  const members = uuids.map((uuid) => fromUuidSync(uuid)).filter(Boolean)
  const missing = uuids.length - members.length

  const remove = async (member) => {
    await actor.update({
      'system.members': uuids.filter((entry) => entry !== member.uuid)
    })
    // Clear the back-reference too, or the member counts as still grouped and
    // cannot be added anywhere else.
    await member.update({ 'system.group': '' })
  }

  return (
    <div>
      <div className="bo-row" style={{ marginBottom: '10px' }}>
        <div className="bo-label" style={{ margin: 0 }}>
          Members
        </div>
        {editable ? (
          <GhostButton tone="accent" onClick={() => setPicking(true)}>
            + Add
          </GhostButton>
        ) : null}
      </div>

      {members.length ? (
        <div className="bo-member-grid">
          {members.map((member) => (
            <div key={member.id} className="bo-member">
              <button
                type="button"
                className="bo-member-portrait"
                title={`Open ${member.name}`}
                onClick={() => member.sheet.render(true)}
              >
                {member.img ? <img src={member.img} alt="" /> : null}
              </button>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="bo-member-name">{member.name}</div>
                <div className="bo-member-type">{member.type}</div>
              </div>
              {editable ? (
                <button
                  type="button"
                  className="bo-mini"
                  title="Remove from group"
                  onClick={() => remove(member)}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="bo-empty" style={{ textAlign: 'left' }}>
          No members yet.
        </p>
      )}

      {missing > 0 ? (
        <p style={{ color: 'var(--bo-text-faint)', fontSize: '15px', marginTop: '8px' }}>
          {missing} member{missing > 1 ? 's' : ''} recorded but no longer in this world.
        </p>
      ) : null}

      {picking ? (
        <MemberPicker actor={actor} taken={uuids} onClose={() => setPicking(false)} />
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------- advantages */

const FEATURE_TYPES = [
  { id: 'merit', label: 'Merit' },
  { id: 'flaw', label: 'Flaw' },
  { id: 'background', label: 'Background' }
]

/** Edits a group advantage in place, rather than opening the system's sheet. */
function AdvantageForm({ item, onSave, onClose }) {
  const [name, setName] = useState(item?.name ?? '')
  const [type, setType] = useState(item?.system?.featuretype ?? 'merit')
  const [points, setPoints] = useState(item?.system?.points ?? 0)
  const [description, setDescription] = useState(item?.system?.description ?? '')

  const save = () => {
    if (!name.trim()) {
      ui.notifications.warn('Give the advantage a name.')
      return
    }
    onSave({ name: name.trim(), featuretype: type, points: Number(points) || 0, description })
    onClose()
  }

  return (
    <Modal title={item ? 'Edit advantage' : 'New advantage'} onClose={onClose}>
      <div className="bo-form-grid" style={{ marginBottom: '12px' }}>
        <label className="bo-field-label">
          <span>Name</span>
          <input
            type="text"
            className="bo-field"
            value={name}
            autoFocus
            placeholder="e.g. Contested Territory"
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="bo-field-label">
          <span>Type</span>
          <Select
            value={type}
            options={FEATURE_TYPES.map((entry) => ({ value: entry.id, label: entry.label }))}
            onChange={setType}
          />
        </label>

        <label className="bo-field-label">
          <span>Dots</span>
          <Select
            value={Number(points) || 0}
            options={[0, 1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }))}
            onChange={setPoints}
          />
        </label>
      </div>

      <label className="bo-field-label" style={{ marginBottom: '14px' }}>
        <span>Description</span>
        <textarea
          className="bo-field"
          rows={5}
          style={{ resize: 'vertical' }}
          value={description}
          placeholder="What it means for the group…"
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <GhostButton tone="accent" onClick={save}>
          Save
        </GhostButton>
      </div>
    </Modal>
  )
}

function GroupFeatures({ actor, editable, locked }) {
  const [editing, setEditing] = useState(null) // { item } or { item: null } for new

  const features = actor.items
    .filter((item) => item.type === 'feature')
    .sort((a, b) => a.name.localeCompare(b.name))

  const save = async (data) => {
    const payload = {
      name: data.name,
      type: 'feature',
      system: {
        featuretype: data.featuretype,
        points: data.points,
        description: data.description
      }
    }

    if (editing?.item) await editing.item.update(payload)
    else await actor.createEmbeddedDocuments('Item', [payload])
  }

  const remove = async (item) => {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      classes: ['blood-oracle', 'bo-dialog'],
      window: { title: 'Remove advantage' },
      content: `<p>Remove <strong>${foundry.utils.escapeHTML(item.name)}</strong>?</p>`
    })
    if (confirmed) await item.delete()
  }

  return (
    <div>
      <div className="bo-row" style={{ marginBottom: '10px' }}>
        <div className="bo-label" style={{ margin: 0 }}>
          Advantages
        </div>
        {editable ? (
          <GhostButton tone="accent" onClick={() => setEditing({ item: null })}>
            + Add
          </GhostButton>
        ) : null}
      </div>

      {features.length ? (
        <div style={{ display: 'grid', gap: '4px' }}>
          {features.map((item) => (
            <div key={item.id} className="bo-stat-row">
              <div className="bo-stat-name">
                <button
                  type="button"
                  className="bo-trait-name"
                  onClick={() => editable && setEditing({ item })}
                >
                  {item.name}
                </button>
                <span className="bo-specialty">({item.system.featuretype})</span>
              </div>
              <DotTracker
                value={item.system.points ?? 0}
                max={5}
                disabled={!editable}
                locked={locked}
                onChange={(next) => item.update({ 'system.points': next })}
              />
              {editable ? (
                <button
                  type="button"
                  className="bo-mini"
                  title="Remove"
                  onClick={() => remove(item)}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="bo-empty" style={{ textAlign: 'left' }}>
          Nothing recorded. Coterie merits and flaws can also be dragged in from a compendium.
        </p>
      )}

      {editing ? (
        <AdvantageForm item={editing.item} onSave={save} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  )
}

/** Things the group owns together — havens, vehicles, anything held in common. */
function GroupProperty({ actor, editable }) {
  const section = {
    id: 'gear',
    place: GEAR_PLACES.property,
    label: 'Property',
    placeholder: 'Havens, vehicles, valuables held in common…'
  }

  const items = itemsOfSection(actor, section)
  const [selectedId, setSelectedId] = useState(null)
  const selected = selectedId ? actor.items.get(selectedId) : null

  const add = async () => {
    const [created] = await actor.createEmbeddedDocuments('Item', [buildItemData(section)])
    if (created) setSelectedId(created.id)
  }

  return (
    <div>
      <div className="bo-row" style={{ marginBottom: '10px' }}>
        <div className="bo-label" style={{ margin: 0 }}>
          Property
        </div>
        {editable ? (
          <GhostButton tone="accent" onClick={add}>
            + Add
          </GhostButton>
        ) : null}
      </div>

      <div className="bo-master-detail">
        <div>
          {items.length ? (
            <div style={{ display: 'grid', gap: '4px' }}>
          {items.map((item) => (
            <div key={item.id} className="bo-stat-row">
              <div className="bo-stat-name">
                <button
                  type="button"
                  className={selectedId === item.id ? 'bo-trait-name is-selected' : 'bo-trait-name'}
                  onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                >
                  {item.name}
                </button>
                {(item.system.quantity ?? 1) > 1 ? (
                  <span style={{ color: 'var(--bo-text-muted)' }}>×{item.system.quantity}</span>
                ) : null}
              </div>
              {editable ? (
                <button
                  type="button"
                  className="bo-mini"
                  title="Remove"
                  onClick={() => {
                    setSelectedId(null)
                    item.delete()
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
          ) : (
            <p className="bo-empty" style={{ textAlign: 'left' }}>
              Nothing held in common.
            </p>
          )}
        </div>

        <div>
          {selected ? (
        <div className="bo-panel">
          <div className="bo-form-grid" style={{ marginBottom: '12px' }}>
            <label className="bo-field-label">
              <span>Name</span>
              <input
                type="text"
                className="bo-field"
                defaultValue={selected.name}
                disabled={!editable}
                onBlur={(event) => selected.update({ name: event.target.value })}
                key={selected.name}
              />
            </label>
            <label className="bo-field-label">
              <span>Quantity</span>
              <input
                type="number"
                className="bo-field"
                min={1}
                defaultValue={selected.system.quantity ?? 1}
                disabled={!editable}
                onBlur={(event) =>
                  selected.update({ 'system.quantity': parseInt(event.target.value, 10) || 1 })
                }
                key={selected.system.quantity}
              />
            </label>
          </div>

          <label className="bo-field-label">
            <span>Notes</span>
            <textarea
              className="bo-field"
              rows={4}
              style={{ resize: 'vertical' }}
              defaultValue={selected.system.description ?? ''}
              disabled={!editable}
              placeholder={section.placeholder}
              onBlur={(event) => selected.update({ 'system.description': event.target.value })}
              key={selected.system.description}
            />
          </label>
        </div>
          ) : (
            <div className="bo-panel">
              <p className="bo-empty" style={{ padding: '24px 0' }}>
                Select an entry to edit it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- app */

export default function GroupApp({ actor, editable, locked, onToggleLock }) {
  const [tab, setTab] = useState('domain')
  const groupType = actor.system.groupType || 'coterie'
  const ratings = RATINGS[groupType] ?? RATINGS.coterie

  const field = (label, path, rows = 5) => (
    <label className="bo-field-label">
      <span>{label}</span>
      <textarea
        className="bo-field"
        rows={rows}
        style={{ resize: 'vertical' }}
        defaultValue={foundry.utils.getProperty(actor, path) ?? ''}
        disabled={!editable}
        onBlur={(event) => {
          if (event.target.value !== (foundry.utils.getProperty(actor, path) ?? '')) {
            actor.update({ [path]: event.target.value })
          }
        }}
        key={foundry.utils.getProperty(actor, path)}
      />
    </label>
  )

  return (
    <div className={`bo-app bo-splat-group is-${groupType}`}>
      <header className="bo-header">
        {actor.img ? <img src={actor.img} alt="" className="bo-portrait" /> : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <EditableText
            value={actor.name}
            editable={editable}
            locked={locked}
            className="bo-name"
            placeholder="Unnamed"
            onCommit={(next) => actor.update({ name: next })}
          />
          <p className="bo-subtitle">
            {GROUP_TYPES.find((entry) => entry.id === groupType)?.label}
            {actor.system.headers?.chronicle ? ` · ${actor.system.headers.chronicle}` : ''}
          </p>
        </div>
        <div className="bo-header-actions">
          {editable ? (
            <div className="bo-group-type">
              <Select
                value={groupType}
                options={GROUP_TYPES.map((entry) => ({ value: entry.id, label: entry.label }))}
                onChange={(value) => {
                  if (locked) return warnLocked()
                  actor.update({ 'system.groupType': value })
                }}
              />
            </div>
          ) : null}
          {editable ? (
            <button
              type="button"
              className={locked ? 'bo-padlock is-locked' : 'bo-padlock'}
              onClick={onToggleLock}
              title={locked ? 'Ratings are locked' : 'Ratings are editable'}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4.5" y="10.5" width="15" height="10" rx="1.6" />
                {locked ? <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /> : <path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" />}
                <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
              </svg>
            </button>
          ) : null}
        </div>
      </header>

      <nav className="bo-tabs">
        {[
          { id: 'domain', label: 'Domain' },
          { id: 'members', label: 'Members' },
          { id: 'notes', label: 'Notes' }
        ].map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={entry.id === tab ? 'bo-tab bo-tab-active' : 'bo-tab'}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === 'domain' ? (
        <div>
          <SectionTitle
            info={
              groupType === 'coterie'
                ? 'A coterie shares a domain. Chasse is how well it feeds them, Lien how deeply it is theirs, Portillon how well it is held. Dots are shared, not personal.'
                : 'Shared ratings for the group, as defined by its own rules.'
            }
          >
            {groupType === 'coterie' ? 'Domain' : 'Shared ratings'}
          </SectionTitle>

          <div style={{ display: 'grid', gap: '4px', marginBottom: '24px' }}>
            {ratings.map((rating) => (
              <div key={rating.id} className="bo-stat-row">
                <div className="bo-stat-name">
                  <span className="bo-trait-name">{rating.label}</span>
                </div>
                <DotTracker
                  value={Number(foundry.utils.getProperty(actor, rating.path)) || 0}
                  max={5}
                  disabled={!editable}
                  locked={locked}
                  onChange={(next) => actor.update({ [rating.path]: next })}
                />
              </div>
            ))}
          </div>

          <SectionTitle>Concept</SectionTitle>
          <div className="bo-pair-grid" style={{ marginBottom: '24px' }}>
            <label className="bo-field-label">
              <span>Concept</span>
              <input
                type="text"
                className="bo-field"
                defaultValue={actor.system.headers?.concept ?? ''}
                disabled={!editable}
                placeholder="What binds them together"
                onBlur={(event) => actor.update({ 'system.headers.concept': event.target.value })}
                key={actor.system.headers?.concept}
              />
            </label>
            <label className="bo-field-label">
              <span>Chronicle</span>
              <input
                type="text"
                className="bo-field"
                defaultValue={actor.system.headers?.chronicle ?? ''}
                disabled={!editable}
                onBlur={(event) => actor.update({ 'system.headers.chronicle': event.target.value })}
                key={actor.system.headers?.chronicle}
              />
            </label>
          </div>

          <div style={{ marginBottom: '24px' }}>{field('Description', 'system.biography', 6)}</div>

          <GroupFeatures actor={actor} editable={editable} locked={locked} />
        </div>
      ) : null}

      {tab === 'members' ? (
        <div>
          <SectionTitle info="Members are ordinary actors in this world. Click a portrait to open that character's own sheet.">
            Who they are
          </SectionTitle>
          <Members actor={actor} editable={editable} />

          <div style={{ marginTop: '28px' }}>
            <SectionTitle info="Anything the group owns together rather than personally — a haven, a car, a safe full of documents.">
              Held in common
            </SectionTitle>
            <GroupProperty actor={actor} editable={editable} />
          </div>
        </div>
      ) : null}

      {tab === 'notes' ? (
        <div>
          <SectionTitle>Chronicle tenets</SectionTitle>
          {editable ? (
            field('Tenets', 'system.headers.tenets', 4)
          ) : (
            <RichText content={actor.system.headers?.tenets} placeholder="No tenets set." />
          )}

          <div style={{ marginTop: '24px' }}>
            <SectionTitle sub="Seen only by those who own this group.">Notes</SectionTitle>
            {field('Private notes', 'system.privatenotes', 5)}
          </div>
        </div>
      ) : null}
    </div>
  )
}
