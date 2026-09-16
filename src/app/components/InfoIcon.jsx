import { useEffect, useId, useRef, useState } from 'react'

/**
 * The circled "i" from the standalone app: click to open a note, click away or
 * press Escape to close, and opening one closes any other.
 *
 * Click rather than hover, as in the original — the notes are a paragraph long
 * and a hover tooltip would be unreadable at that length.
 */
export default function InfoIcon({ text, size = 18 }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const id = useId()

  useEffect(() => {
    if (!open) return

    // Tell any other open icon to close.
    window.dispatchEvent(new CustomEvent('bo-info:open', { detail: { id } }))

    const onOtherOpen = (event) => {
      if (event.detail?.id !== id) setOpen(false)
    }
    const onClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }

    window.addEventListener('bo-info:open', onOtherOpen)
    document.addEventListener('mousedown', onClickOutside)
    // Capture, so Escape closes the note before Foundry closes the sheet.
    document.addEventListener('keydown', onKey, true)

    return () => {
      window.removeEventListener('bo-info:open', onOtherOpen)
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, id])

  if (!text) return null

  return (
    <span className="bo-info" ref={rootRef}>
      <button
        type="button"
        className={open ? 'bo-info-button is-open' : 'bo-info-button'}
        style={{ width: `${size}px`, height: `${size}px` }}
        aria-expanded={open}
        aria-label="Toggle help"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
      >
        i
      </button>
      {open ? <span className="bo-info-note">{text}</span> : null}
    </span>
  )
}
