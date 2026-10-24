import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { paletteOf, placement } from '../components/floating.js'
import { rollOdds } from './odds.js'

function pct(p) {
  if (p === null || p === undefined) return '—'
  if (p <= 0) return '0%'
  if (p < 0.001) return '<0.1%'
  if (p > 0.9995) return '>99.9%'
  return `${(p * 100).toFixed(1)}%`
}

/**
 * Exact odds for the pool as it stands: a summary for the chosen difficulty
 * and a table by number of successes. Willpower rerolls are not counted —
 * they depend on what the player decides after seeing the dice.
 */
export default function OddsPopover({ anchor, basicDice, hungerDice, difficulty, onClose }) {
  const [layout, setLayout] = useState(null)
  const boxRef = useRef(null)

  const odds = useMemo(
    () => rollOdds(basicDice, hungerDice, difficulty),
    [basicDice, hungerDice, difficulty]
  )

  // Beside the roll dialog when there is room, so the Storyteller can change
  // the difficulty and the pool and watch the odds follow. Otherwise under the
  // button, where it would cover the dialog and so closes on any click.
  const dialog = anchor?.closest('.bo-modal') ?? null

  const measure = () => {
    if (!anchor) return
    const width = 320
    let position = null
    let beside = false
    if (dialog) {
      const rect = dialog.getBoundingClientRect()
      const top = Math.max(8, rect.top)
      const maxHeight = window.innerHeight - top - 8
      if (window.innerWidth - rect.right >= width + 18) {
        position = { left: rect.right + 10, top, width, maxHeight }
        beside = true
      } else if (rect.left >= width + 18) {
        position = { left: rect.left - width - 10, top, width, maxHeight }
        beside = true
      }
    }
    setLayout({
      position: position ?? placement(anchor, { minWidth: width, maxHeight: 520, needBelow: 360 }),
      beside,
      palette: paletteOf(anchor)
    })
  }

  useLayoutEffect(measure, [anchor, dialog])

  useEffect(() => {
    const onPointer = (event) => {
      if (boxRef.current?.contains(event.target) || anchor?.contains(event.target)) return
      // Beside the dialog it stays while the dialog is used, its dropdowns included.
      if (layout?.beside && (dialog?.contains(event.target) || event.target.closest?.('.bo-select-menu'))) return
      onClose()
    }
    const onScroll = (event) => {
      if (boxRef.current?.contains(event.target)) return
      // Beside the dialog it follows it when the sheet scrolls.
      if (layout?.beside) return measure()
      onClose()
    }
    // Window capture runs before the roll dialog's own Escape handler, so
    // Escape closes only this.
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      event.preventDefault()
      onClose()
    }
    document.addEventListener('mousedown', onPointer, true)
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onPointer, true)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [anchor, dialog, layout, onClose])

  if (!anchor || !layout) return null

  const hasTarget = odds.difficulty > 0
  // The tail of the table is all zeros; stop where it stops mattering, but
  // never before the chosen difficulty.
  const rows = odds.table.filter((row) => row.atLeast >= 0.0005 || row.successes <= odds.difficulty)
  const summary = hasTarget
    ? [
        { label: `Win (${odds.difficulty}+ successes)`, value: odds.win, tone: 'is-win' },
        { label: 'Critical win', value: odds.criticalWin, tone: 'is-crit' },
        { label: 'Messy critical', value: odds.messyCritical, tone: 'is-messy', hidden: !hungerDice },
        { label: 'Bestial failure', value: odds.bestialFailure, tone: 'is-bestial', hidden: !hungerDice },
        { label: 'Total failure', value: odds.totalFailure, tone: 'is-fail' }
      ]
    : [
        { label: 'A pair of 10s', value: odds.anyPair, tone: 'is-crit' },
        { label: 'Total failure', value: odds.totalFailure, tone: 'is-fail' }
      ]

  return createPortal(
    <div
      ref={boxRef}
      className="bo-odds"
      style={{ ...layout.palette, ...layout.position }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="bo-odds-head">
        Odds · {basicDice} normal, {hungerDice} hunger
      </div>

      <div className="bo-odds-summary">
        {summary
          .filter((row) => !row.hidden)
          .map((row) => (
            <div key={row.label} className={`bo-odds-line ${row.tone}`}>
              <span>{row.label}</span>
              <span className="bo-odds-value">{pct(row.value)}</span>
            </div>
          ))}
        {!hasTarget ? (
          <div className="bo-odds-hint">Set a difficulty to see the chance to win, crit or fail bestially.</div>
        ) : null}
      </div>

      <table className="bo-odds-table">
        <thead>
          <tr>
            <th>Successes</th>
            <th>Exactly</th>
            <th>At least</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.successes} className={row.successes === odds.difficulty && hasTarget ? 'is-target' : undefined}>
              <td>{row.successes}</td>
              <td>{pct(row.exactly)}</td>
              <td>{pct(row.atLeast)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="bo-odds-hint">
        Willpower rerolls are not counted. “At least N” is the chance to win at difficulty N.
      </div>
    </div>,
    document.body
  )
}
