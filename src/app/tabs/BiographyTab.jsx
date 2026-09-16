import { useState } from 'react'
import { SectionTitle } from '../components/primitives.jsx'
import PrinciplesEditor from '../components/PrinciplesEditor.jsx'
import { clanNames, predatorNames, isLoaded } from '../rules/catalog.js'
import { readSingletonName, setSingleton } from '../schema/singletons.js'
import { MODULE_ID } from '../../constants.js'
import { splatOf } from '../splats.js'

const GENERATIONS = [
  '4th', '5th', '6th', '7th', '8th', '9th', '10th',
  '11th', '12th', '13th', '14th', '15th', '16th'
]

const SECTS = ['Camarilla', 'Anarch', 'Sabbat', 'Autarkis / Independent']

const OTHER = '__other__'

/**
 * Uncontrolled text field committed on blur. `key` is tied to the stored value
 * so an external change (another client, an import) refreshes the input, while
 * typing is never interrupted mid-word by a re-render.
 */
function Field({ label, value, onCommit, editable, multiline = false, rows = 8, placeholder }) {
  const commit = (event) => {
    if (event.target.value !== (value ?? '')) onCommit(event.target.value)
  }

  return (
    <label className="bo-field-label">
      <span>{label}</span>
      {multiline ? (
        <textarea
          className="bo-field"
          rows={rows}
          style={{ resize: 'vertical' }}
          defaultValue={value ?? ''}
          disabled={!editable}
          placeholder={placeholder}
          onBlur={commit}
          key={value}
        />
      ) : (
        <input
          type="text"
          className="bo-field"
          defaultValue={value ?? ''}
          disabled={!editable}
          placeholder={placeholder}
          onBlur={commit}
          key={value}
        />
      )}
    </label>
  )
}

function Select({ label, value, options, editable, onChange, placeholder = '—' }) {
  return (
    <label className="bo-field-label">
      <span>{label}</span>
      <select
        className="bo-field"
        value={value ?? ''}
        disabled={!editable}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((entry) => (
          <option key={entry} value={entry}>
            {entry}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Predator type, with a free-text escape hatch for homebrew. */
function PredatorField({ actor, editable }) {
  const current = readSingletonName(actor, 'predatorType')
  const known = predatorNames()
  const isKnown = !current || known.includes(current)
  const [other, setOther] = useState(!isKnown)

  return (
    <div>
      <label className="bo-field-label">
        <span>Predator type</span>
        {other ? (
          <input
            type="text"
            className="bo-field"
            defaultValue={isKnown ? '' : current}
            disabled={!editable}
            placeholder="Homebrew predator type"
            onBlur={(event) => setSingleton(actor, 'predatorType', event.target.value)}
          />
        ) : (
          <select
            className="bo-field"
            value={isKnown ? current : ''}
            disabled={!editable}
            onChange={(event) => {
              if (event.target.value === OTHER) {
                setOther(true)
                if (isKnown) setSingleton(actor, 'predatorType', '')
                return
              }
              setSingleton(actor, 'predatorType', event.target.value)
            }}
          >
            <option value="">Choose predator type…</option>
            {known.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
            <option value={OTHER}>Other (custom)…</option>
          </select>
        )}
      </label>

      {other && editable ? (
        <button
          type="button"
          className="bo-trait-name"
          style={{ color: 'var(--bo-text-faint)', fontSize: '13px', marginTop: '4px' }}
          onClick={() => setOther(false)}
        >
          back to the list
        </button>
      ) : null}

    </div>
  )
}

function Portrait({ actor, editable }) {
  const browse = async () => {
    if (!editable) return
    const picker = new foundry.applications.apps.FilePicker.implementation({
      type: 'image',
      current: actor.img || '',
      callback: (path) => actor.update({ img: path })
    })
    await picker.browse()
  }

  return (
    <div className="bo-field-label">
      <span>Portrait</span>
      <button
        type="button"
        className="bo-portrait-slot is-large"
        onClick={browse}
        disabled={!editable}
      >
        {actor.img ? <img src={actor.img} alt="" /> : <span>Click to upload</span>}
      </button>
    </div>
  )
}

export default function BiographyTab({ actor, editable }) {
  const splat = splatOf(actor)
  const headers = actor.system.headers ?? {}
  const set = (path) => (value) => actor.update({ [path]: value })

  return (
    <div>
      <SectionTitle>Identity</SectionTitle>
      <div className="bo-identity">
        <Portrait actor={actor} editable={editable} />

        <div className="bo-pair-grid">
          <Field
            label="Name"
            value={actor.name}
            editable={editable}
            onCommit={(value) => actor.update({ name: value })}
          />
          <Field
            label="Concept"
            value={headers.concept}
            editable={editable}
            placeholder="e.g. Disgraced surgeon"
            onCommit={set('system.headers.concept')}
          />
          <Field
            label="Chronicle"
            value={headers.chronicle}
            editable={editable}
            onCommit={set('system.headers.chronicle')}
          />

          {isLoaded() ? (
            <Select
              label="Clan"
              value={readSingletonName(actor, 'clan')}
              options={clanNames()}
              editable={editable}
              placeholder="Choose clan…"
              onChange={(value) => setSingleton(actor, 'clan', value)}
            />
          ) : (
            // Without the reference there is no clan list, so it is typed.
            <Field
              label="Clan"
              value={readSingletonName(actor, 'clan')}
              editable={editable}
              onCommit={(value) => setSingleton(actor, 'clan', value)}
            />
          )}

          {splat.potency ? <PredatorField actor={actor} editable={editable} /> : null}

          <Field
            label="Sire"
            value={headers.sire}
            editable={editable}
            onCommit={set('system.headers.sire')}
          />

          {/* The system's headers have no sect or title, so both live in flags. */}
          <Select
            label="Sect"
            value={actor.getFlag(MODULE_ID, 'sect') ?? ''}
            options={SECTS}
            editable={editable}
            onChange={(value) => actor.setFlag(MODULE_ID, 'sect', value)}
          />
          <Select
            label="Generation"
            value={headers.generation}
            options={GENERATIONS}
            editable={editable}
            placeholder="Choose generation…"
            onChange={set('system.headers.generation')}
          />
          <Field
            label="Title"
            value={actor.getFlag(MODULE_ID, 'title') ?? ''}
            editable={editable}
            placeholder="Sheriff, Harpy, Prince, Hound…"
            onCommit={(value) => actor.setFlag(MODULE_ID, 'title', value)}
          />
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <SectionTitle>Vital records</SectionTitle>
        <div className="bo-quad-grid">
          <Field
            label="Age (real)"
            value={actor.system.bio?.age?.trueage}
            editable={editable}
            placeholder="e.g. 312"
            onCommit={set('system.bio.age.trueage')}
          />
          <Field
            label="Apparent age"
            value={actor.system.bio?.age?.apparent}
            editable={editable}
            placeholder="e.g. 28"
            onCommit={set('system.bio.age.apparent')}
          />
          <Field
            label="Date of birth"
            value={actor.system.bio?.dateof?.birth}
            editable={editable}
            placeholder="YYYY-MM-DD or 1714"
            onCommit={set('system.bio.dateof.birth')}
          />
          <Field
            label="Date of death"
            value={actor.system.bio?.dateof?.death}
            editable={editable}
            placeholder="Date of Embrace"
            onCommit={set('system.bio.dateof.death')}
          />
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <SectionTitle>Biography &amp; appearance</SectionTitle>
        <div className="bo-pair-grid">
          <Field
            label="Biography"
            value={actor.system.biography}
            editable={editable}
            multiline
            placeholder="Personal history, family, mortal life, the night of Embrace, what happened since…"
            onCommit={set('system.biography')}
          />
          <Field
            label="Appearance"
            value={actor.system.appearance}
            editable={editable}
            multiline
            placeholder="Physical description — face, build, voice, style of dress, distinguishing marks…"
            onCommit={set('system.appearance')}
          />
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <SectionTitle>Goals</SectionTitle>
        <div className="bo-pair-grid">
          <Field
            label="Ambition"
            value={headers.ambition}
            editable={editable}
            multiline
            rows={4}
            placeholder="Long-term goal"
            onCommit={set('system.headers.ambition')}
          />
          <Field
            label="Desire"
            value={headers.desire}
            editable={editable}
            multiline
            rows={4}
            placeholder="Short-term want"
            onCommit={set('system.headers.desire')}
          />
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <SectionTitle
          info="Tenets are the chronicle's baseline; Principles pair a personal Conviction with the mortal who anchors it. Breaking a Tenet causes Stains. A Conviction only holds while a mortal Touchstone anchors it — if that mortal dies, the Conviction is lost. A starting character has up to three."
        >
          Tenets &amp; principles
        </SectionTitle>
        <Field
          label="Chronicle tenets"
          value={headers.tenets}
          editable={editable}
          multiline
          rows={4}
          placeholder="The chronicle's shared moral principles (set by Storyteller). Breaking these causes Stains…"
          onCommit={set('system.headers.tenets')}
        />
        <PrinciplesEditor actor={actor} editable={editable} />
      </div>
    </div>
  )
}
