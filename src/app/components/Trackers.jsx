import { warnLocked } from '../lock.js'

/**
 * Trackers carried over from the standalone app, including its interaction
 * model: left click advances a box, right click reverses it.
 *
 * Damage, hunger and humanity are never locked: they change constantly in play,
 * and a padlock in the way would be a nuisance rather than a guard.
 */

function DamageBox({ state, onClick, onRightClick, size = 18 }) {
  const isSuperficial = state === 'superficial'
  const isAggravated = state === 'aggravated'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick?.()
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        onRightClick?.()
      }}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: `1px solid ${state === 'empty' ? 'var(--bo-box-border)' : 'var(--bo-box-border-lit)'}`,
        background: isAggravated
          ? 'var(--bo-box-fill)'
          : 'var(--bo-box-bg)',
        position: 'relative',
        borderRadius: '2px',
        cursor: 'pointer',
        flex: 'none',
        boxShadow: isAggravated
          ? '0 0 6px rgba(var(--bo-glow-rgb), 0.45), inset 0 0 6px rgba(var(--bo-glow-rgb), 0.25)'
          : 'none',
        transition: 'all 150ms ease'
      }}
    >
      {isSuperficial ? (
        <svg viewBox="0 0 22 22" width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
          <line x1="3" y1="19" x2="19" y2="3" stroke="var(--bo-damage-soft)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ) : null}
      {isAggravated ? (
        <svg viewBox="0 0 22 22" width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
          <line x1="3" y1="3" x2="19" y2="19" stroke="var(--bo-damage)" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="19" y1="3" x2="3" y2="19" stroke="var(--bo-damage)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ) : null}
    </div>
  )
}

/**
 * Health and willpower. Aggravated fills from the left, superficial sits after
 * it, which is how the standalone app ordered the track.
 */
export function DamageTracker({ label, max, superficial, aggravated, onUpdate, disabled, onRoll }) {
  const boxes = []
  for (let i = 0; i < max; i++) {
    if (i < aggravated) boxes.push('aggravated')
    else if (i < aggravated + superficial) boxes.push('superficial')
    else boxes.push('empty')
  }

  const clamp = (next) => ({
    superficial: Math.max(0, Math.min(max, next.superficial)),
    aggravated: Math.max(0, Math.min(max, next.aggravated))
  })

  const forward = (index) => {
    if (disabled) return
    const state = boxes[index]
    if (state === 'empty') onUpdate(clamp({ superficial: superficial + 1, aggravated }))
    else if (state === 'superficial')
      onUpdate(clamp({ superficial: superficial - 1, aggravated: aggravated + 1 }))
    else onUpdate(clamp({ superficial, aggravated: aggravated - 1 }))
  }

  const backward = (index) => {
    if (disabled) return
    const state = boxes[index]
    if (state === 'aggravated')
      onUpdate(clamp({ superficial: superficial + 1, aggravated: aggravated - 1 }))
    else if (state === 'superficial') onUpdate(clamp({ superficial: superficial - 1, aggravated }))
    else onUpdate(clamp({ superficial, aggravated: aggravated + 1 }))
  }

  const impaired = max > 0 && superficial + aggravated >= max

  return (
    <div className="bo-tracker">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div
          className="bo-tracker-label"
          style={{ marginBottom: 0, ...(impaired ? { color: 'var(--bo-damage)' } : {}) }}
        >
          {label}
          {impaired ? <span style={{ marginLeft: '10px' }}>· Impaired</span> : null}
        </div>
        {onRoll ? (
          <button type="button" className="bo-mini" title={`Roll ${label}`} onClick={onRoll}>
            ⚀
          </button>
        ) : null}
      </div>
      <div className="bo-tracker-boxes">
        {boxes.map((state, index) => (
          <DamageBox
            key={index}
            state={state}
            onClick={() => forward(index)}
            onRightClick={() => backward(index)}
          />
        ))}
      </div>
    </div>
  )
}

export function HumanityTracker({ humanity, stains, onUpdate, disabled }) {
  return (
    <div className="bo-tracker">
      <div className="bo-tracker-label">Humanity</div>
      <div className="bo-tracker-boxes">
        {Array.from({ length: 10 }, (_, i) => {
          const filled = i < humanity
          // Stains accumulate from the far end of the track inwards.
          const stained = !filled && i >= 10 - stains

          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              title="Click to set Humanity. Right-click an empty box to toggle a Stain."
              onClick={() => {
                if (disabled) return
                onUpdate({ humanity: filled ? i : i + 1 })
              }}
              onKeyDown={(event) => {
                if (disabled) return
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onUpdate({ humanity: filled ? i : i + 1 })
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                if (disabled || filled) return
                onUpdate({
                  stains: stained ? Math.max(0, stains - 1) : Math.min(10 - humanity, stains + 1)
                })
              }}
              style={{
                width: '18px',
                height: '18px',
                border: `1px solid ${filled ? 'var(--bo-humanity)' : 'var(--bo-dot-empty)'}`,
                background: filled
                  ? 'linear-gradient(135deg, var(--bo-humanity), color-mix(in srgb, var(--bo-humanity) 45%, #000))'
                  : 'var(--bo-box-bg)',
                borderRadius: '2px',
                position: 'relative',
                cursor: 'pointer',
                flex: 'none',
                boxShadow: filled ? '0 0 4px rgba(200, 160, 96, 0.35)' : 'none',
                transition: 'all 150ms ease'
              }}
            >
              {stained ? (
                <svg viewBox="0 0 22 22" width="18" height="18" style={{ position: 'absolute', inset: 0 }}>
                  <line x1="3" y1="19" x2="19" y2="3" stroke="var(--bo-damage-soft)" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function HungerTracker({ value, max = 5, onChange, disabled, inlineExtra }) {
  return (
    <div className="bo-tracker">
      <div className="bo-tracker-label">Hunger</div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="bo-tracker-boxes">
          {Array.from({ length: max }, (_, i) => {
            const position = i + 1
            const filled = position <= value
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => !disabled && onChange(value === position ? position - 1 : position)}
                onKeyDown={(event) => {
                  if (disabled) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onChange(value === position ? position - 1 : position)
                  }
                }}
                style={{
                  width: '18px',
                  height: '18px',
                  border: `1px solid ${filled ? 'var(--bo-hunger)' : 'var(--bo-box-border-lit)'}`,
                  borderRadius: '2px',
                  background: filled
                    ? 'linear-gradient(135deg, var(--bo-hunger), color-mix(in srgb, var(--bo-hunger) 45%, #000))'
                    : 'var(--bo-box-bg)',
                  cursor: 'pointer',
                  flex: 'none',
                  boxShadow: filled
                    ? '0 0 6px rgba(var(--bo-glow-rgb), 0.5), inset 0 0 4px rgba(var(--bo-glow-rgb), 0.3)'
                    : 'none',
                  transition: 'all 150ms ease'
                }}
              />
            )
          })}
        </div>
        {inlineExtra}
      </div>
    </div>
  )
}

export function LinearPips({ label, value, max, onChange, fillStart, fillEnd, disabled, locked }) {
  return (
    <div className="bo-tracker">
      <div className="bo-tracker-label">{label}</div>
      <div className="bo-tracker-boxes">
        {Array.from({ length: max }, (_, i) => {
          const position = i + 1
          const filled = position <= value
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (disabled) return
                if (locked) return warnLocked()
                onChange(value === position ? position - 1 : position)
              }}
              onKeyDown={(event) => {
                if (disabled || locked) return
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onChange(value === position ? position - 1 : position)
                }
              }}
              style={{
                width: '28px',
                height: '11px',
                borderRadius: '2px',
                background: filled
                  ? `linear-gradient(90deg, ${fillStart}, ${fillEnd})`
                  : 'var(--bo-box-bg)',
                border: `1px solid ${filled ? fillStart : 'var(--bo-box-border)'}`,
                cursor: 'pointer',
                flex: 'none',
                boxShadow: filled ? `0 0 6px ${fillStart}80` : 'none',
                transition: 'all 150ms ease'
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
