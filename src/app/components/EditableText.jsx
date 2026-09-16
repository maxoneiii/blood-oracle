import { useEffect, useRef, useState } from 'react'
import { warnLocked } from '../lock.js'

/**
 * Click-to-edit text, matching the standalone app's habit of letting fields be
 * edited in place rather than through a separate form. Enter commits, Escape
 * abandons, blur commits.
 */
export default function EditableText({
  value,
  onCommit,
  editable = true,
  locked = false,
  placeholder = '',
  className = '',
  as = 'h1'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    const next = draft.trim()
    if (next !== (value ?? '')) onCommit(next)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className={`bo-inline-input ${className}`}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') setEditing(false)
        }}
      />
    )
  }

  const Tag = as
  const empty = !value
  const start = () => {
    if (!editable) return
    if (locked) return warnLocked()
    setDraft(value ?? '')
    setEditing(true)
  }

  return (
    <Tag
      className={`${className} ${editable ? 'bo-editable' : ''} ${empty ? 'is-empty' : ''}`.trim()}
      onClick={start}
      title={editable ? 'Click to edit' : undefined}
    >
      {value || placeholder}
    </Tag>
  )
}
