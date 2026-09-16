import { useState } from 'react'
import { SectionTitle, GhostButton } from '../components/primitives.jsx'
import {
  readNotes,
  addNote,
  updateNote,
  removeNote,
  readExperiences,
  experienceTotals,
  addExperience,
  removeExperience
} from '../schema/journal.js'

/* ------------------------------------------------------------------ notes */

function NoteCard({ actor, note, editable }) {
  const [open, setOpen] = useState(!note.title && !note.text)

  const pickImage = async () => {
    if (!editable) return
    const picker = new foundry.applications.apps.FilePicker.implementation({
      type: 'image',
      current: note.image || '',
      callback: (path) => updateNote(actor, note.id, { image: path })
    })
    await picker.browse()
  }

  const confirmRemove = async () => {
    const named = note.title?.trim() || 'this note'
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      classes: ['blood-oracle', 'bo-dialog'],
      window: { title: 'Delete note' },
      content: `<p>Delete <strong>${foundry.utils.escapeHTML(named)}</strong>? This cannot be undone.</p>`
    })
    if (confirmed) removeNote(actor, note.id)
  }

  return (
    <div className="bo-panel" style={{ marginBottom: '12px' }}>
      {/* One title, editable in place — the card header and the form field were
          the same value shown twice. */}
      <div className="bo-row" style={{ marginBottom: open ? '12px' : 0 }}>
        <input
          type="text"
          className="bo-note-title"
          defaultValue={note.title}
          disabled={!editable}
          placeholder="Block title (Session 3, NPCs, Plot thread…)"
          onBlur={(event) => updateNote(actor, note.id, { title: event.target.value })}
          key={note.title}
        />
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            type="button"
            className="bo-mini"
            title={open ? 'Collapse' : 'Open'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? '−' : '+'}
          </button>
          {editable ? (
            <button type="button" className="bo-mini" title="Delete note" onClick={confirmRemove}>
              ×
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="bo-note-body">
          <div>
            <label className="bo-field-label">
              <span>Text</span>
              <textarea
                className="bo-field"
                rows={6}
                style={{ resize: 'vertical' }}
                defaultValue={note.text}
                disabled={!editable}
                placeholder="Write freely…"
                onBlur={(event) => updateNote(actor, note.id, { text: event.target.value })}
                key={note.text}
              />
            </label>
          </div>

          <div className="bo-field-label" style={{ width: '120px', flex: 'none' }}>
            <span>Image</span>
            <button
              type="button"
              className="bo-portrait-slot"
              onClick={pickImage}
              disabled={!editable}
            >
              {note.image ? <img src={note.image} alt="" /> : <span>add image</span>}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------ experience */

function ExperienceLedger({ actor, editable }) {
  const entries = readExperiences(actor)
  const { total, remaining } = experienceTotals(actor)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState(1)

  const record = async (spend) => {
    await addExperience(actor, { name, amount, spend })
    setName('')
    setAmount(1)
  }

  return (
    <div>
      <div className="bo-xp-totals">
        <div className="bo-potency-card">
          <div className="bo-label">Earned</div>
          <div className="bo-potency-value">{total}</div>
        </div>
        <div className="bo-potency-card">
          <div className="bo-label">Remaining</div>
          <div
            className="bo-potency-value"
            style={{ color: remaining < 0 ? 'var(--bo-accent-red)' : 'var(--bo-accent)' }}
          >
            {remaining}
          </div>
        </div>
      </div>

      {editable ? (
        <div className="bo-panel" style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <label className="bo-field-label" style={{ flex: 1 }}>
            <span>What for</span>
            <input
              type="text"
              className="bo-field"
              value={name}
              placeholder="Session 12, raised Auspex to 3…"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="bo-field-label" style={{ width: '90px', flex: 'none' }}>
            <span>Amount</span>
            <input
              type="number"
              className="bo-field"
              min={1}
              value={amount}
              onChange={(event) => setAmount(parseInt(event.target.value, 10) || 1)}
            />
          </label>
          <GhostButton tone="accent" onClick={() => record(false)}>
            Earn
          </GhostButton>
          <GhostButton tone="danger" onClick={() => record(true)}>
            Spend
          </GhostButton>
        </div>
      ) : null}

      {entries.length ? (
        <div style={{ marginTop: '14px' }}>
          {[...entries]
            .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
            .map((entry) => (
              <div key={entry.id} className="bo-stat-row">
                <div className="bo-stat-name">
                  <span>{entry.name}</span>
                  {entry.timestamp ? (
                    <span className="bo-xp-date">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
                <span
                  className="bo-xp-value"
                  style={{
                    color: entry.value < 0 ? 'var(--bo-accent-red)' : 'var(--bo-accent)'
                  }}
                >
                  {entry.value > 0 ? '+' : '−'}
                  {Math.abs(entry.value)}
                </span>
                {editable ? (
                  <button
                    type="button"
                    className="bo-mini"
                    title="Remove this entry"
                    onClick={() => removeExperience(actor, entry.id)}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
        </div>
      ) : (
        <p className="bo-empty" style={{ textAlign: 'left', marginTop: '10px' }}>
          Nothing earned or spent yet.
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------- tab */

export default function NotesTab({ actor, editable }) {
  const notes = readNotes(actor)

  return (
    <div>
      <SectionTitle
        sub="Kept with the character, and seen only by its owner and the Storyteller."
        actions={
          editable ? (
            <GhostButton tone="accent" onClick={() => addNote(actor)}>
              + Add note
            </GhostButton>
          ) : null
        }
      >
        Notes
      </SectionTitle>

      {notes.length ? (
        <div className="bo-note-grid">
          {notes.map((note) => (
            <NoteCard key={note.id} actor={actor} note={note} editable={editable} />
          ))}
        </div>
      ) : (
        <p className="bo-empty" style={{ textAlign: 'left' }}>
          Nothing written down. The Kindred who remember everything are the ones who last.
        </p>
      )}

      <div style={{ marginTop: '30px' }}>
        <SectionTitle
        info="Positive entries are earned, negative are spent. Kept in the system's own ledger, so the totals match the wod5e sheet exactly.">Experience</SectionTitle>
        <ExperienceLedger actor={actor} editable={editable} />
      </div>
    </div>
  )
}
