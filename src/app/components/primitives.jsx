import { useEffect } from 'react'
import InfoIcon from './InfoIcon.jsx'

/** Section heading: red, letter-spaced, with a fading rule beneath. */
export function SectionTitle({ children, sub, actions, info }) {
  return (
    <div className="bo-section">
      <div className="bo-row">
        <h2 className="bo-section-title">
          {children}
          {info ? <InfoIcon text={info} /> : null}
        </h2>
        {actions ? <div style={{ display: 'flex', gap: '8px' }}>{actions}</div> : null}
      </div>
      {sub ? <p className="bo-section-sub">{sub}</p> : null}
      <div className="bo-section-rule" />
    </div>
  )
}

/** Values the standalone app treats as "nothing to say", rendered as an em dash. */
const EMPTY_VALUES = ['', '—', 'None', 'N/A', 'No']

export function isEmptyValue(value) {
  return EMPTY_VALUES.includes(String(value ?? '').trim())
}

export function LabelledValue({ label, value }) {
  const empty = isEmptyValue(value)
  return (
    <div>
      <div className="bo-label">{label}</div>
      <div className={empty ? 'bo-value is-empty' : 'bo-value'}>{empty ? '—' : value}</div>
    </div>
  )
}

/** A titled prose block separated by a rule, as used for System, Process etc. */
export function Block({ label, children, mono = false }) {
  return (
    <div className="bo-block">
      <div className="bo-label">{label}</div>
      <div className={mono ? 'bo-mono' : 'bo-prose'}>{children}</div>
    </div>
  )
}

export function GhostButton({ tone, children, ...props }) {
  const className = ['bo-ghost', tone === 'accent' ? 'is-accent' : '', tone === 'danger' ? 'is-danger' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" className={className} {...props}>
      {children}
    </button>
  )
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </svg>
  )
}

export function FullRulesButton({ onClick }) {
  return (
    <button type="button" className="bo-ghost is-accent bo-fullrules" onClick={onClick}>
      <BookIcon />
      Full rules
    </button>
  )
}

/**
 * Overlay dialog. Deliberately absolute rather than fixed: a sheet is one
 * window among many in Foundry, and an overlay covering the whole viewport
 * would sit on top of unrelated windows.
 */
export function Modal({ title, subtitle, wide = false, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    // Capture phase, so Escape closes this dialog before Foundry closes the sheet.
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="bo-modal-backdrop" onMouseDown={onClose}>
      <div
        className={wide ? 'bo-modal is-wide' : 'bo-modal'}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="bo-row" style={{ alignItems: 'flex-start' }}>
          <h2 className="bo-detail-title">{title}</h2>
          <button type="button" className="bo-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {subtitle ? <p className="bo-detail-sub">{subtitle}</p> : null}
        {children}
      </div>
    </div>
  )
}
