import { useMemo, useState } from 'react'
import { searchEntries, isLoaded } from '../rules/catalog.js'

/**
 * Search box over the rules reference. Picking an entry fills the form; every
 * field stays editable afterwards, so this is a shortcut rather than a
 * constraint. Renders nothing when no reference is loaded.
 */
export default function CatalogPicker({ discipline, onPick, ownedNames = [] }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const owned = useMemo(
    () => new Set(ownedNames.map((name) => String(name).toLowerCase())),
    [ownedNames]
  )

  const results = useMemo(
    () => (open ? searchEntries(query, { discipline, limit: 30 }) : []),
    [query, discipline, open]
  )

  if (!isLoaded()) return null

  return (
    <div className="bo-catalog">
      <label className="bo-field-label">
        <span>Find in the reference</span>
        <input
          type="text"
          className="bo-field"
          value={query}
          placeholder="Start typing a name, or leave empty to browse…"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
        />
      </label>

      {open && results.length ? (
        <ul className="bo-catalog-list">
          {results.map((entry) => {
            const isOwned = owned.has(entry.name.toLowerCase())
            return (
              <li key={`${entry.discipline}-${entry.name}`}>
                <button
                  type="button"
                  className={isOwned ? 'bo-catalog-item is-owned' : 'bo-catalog-item'}
                  disabled={isOwned}
                  onClick={() => {
                    onPick(entry)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <span>{entry.name}</span>
                  <span className="bo-catalog-meta">
                    {entry.level ? `Level ${entry.level}` : ''}
                    {entry.amalgam ? ` · ${entry.amalgam}` : ''}
                    {isOwned ? ' · already known' : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {open && query && !results.length ? (
        <p style={{ color: 'var(--bo-text-faint)', fontSize: '14px', margin: '6px 0 0' }}>
          Nothing in the reference matches that.
        </p>
      ) : null}
    </div>
  )
}
