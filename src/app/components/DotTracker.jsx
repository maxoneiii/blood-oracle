
/**
 * Five-dot rating widget. Clicking the dot that is already the current value
 * clears it back to `min`, which is how the standalone app behaved.
 */
import { warnLocked } from '../lock.js'

/**
 * `disabled` means the user has no right to edit. `locked` means they do, but
 * the padlock is on — so the click is answered with an explanation rather than
 * silence.
 */
export default function DotTracker({
  value,
  max = 5,
  min = 0,
  onChange,
  size = 16,
  color = 'var(--bo-dot)',
  disabled = false,
  locked = false
}) {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1
        const filled = n <= value
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-disabled={locked || undefined}
            aria-label={`Set to ${n}`}
            onClick={() => {
              if (disabled) return
              if (locked) {
                warnLocked()
                return
              }
              // Clicking the current value clears back to the minimum, which is
              // zero for traits but can be higher for a merit with a floor.
              onChange(value === n ? min : Math.max(n, min))
            }}
            style={{
              width: `${size}px`,
              height: `${size}px`,
              minWidth: `${size}px`,
              // Foundry's own button rules set width/flex on every button in a
              // sheet, which stretches these into ellipses. Pin both axes.
              flex: 'none',
              boxSizing: 'border-box',
              padding: 0,
              lineHeight: 1,
              borderRadius: '50%',
              border: `1px solid ${filled ? color : 'var(--bo-dot-empty)'}`,
              background: filled ? color : 'transparent',
              boxShadow: filled ? '0 0 6px rgba(200, 160, 96, 0.33)' : 'none',
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              // Locked dots stay fully legible; only the outline softens.
              filter: locked ? 'saturate(0.75)' : 'none',
              transition: 'background 120ms, border-color 120ms'
            }}
          />
        )
      })}
    </div>
  )
}
