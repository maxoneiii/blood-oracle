/**
 * A small number control: − value +. The value can also be typed.
 */
export default function Stepper({ label, value, min = -Infinity, max = Infinity, onChange, disabled = false }) {
  const clamp = (next) => Math.max(min, Math.min(max, next))
  const set = (next) => onChange(clamp(Number.isFinite(next) ? next : 0))

  return (
    <div className="bo-stepper">
      <span className="bo-stepper-label">{label}</span>
      <div className="bo-stepper-box">
        <button
          type="button"
          className="bo-stepper-button"
          disabled={disabled || value <= min}
          onClick={() => set(value - 1)}
          aria-label={`Lower ${label}`}
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          className="bo-stepper-value"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            const raw = event.target.value.trim()
            if (raw === '' || raw === '-') return onChange(0)
            const parsed = parseInt(raw, 10)
            if (Number.isFinite(parsed)) set(parsed)
          }}
          onFocus={(event) => event.target.select()}
        />
        <button
          type="button"
          className="bo-stepper-button"
          disabled={disabled || value >= max}
          onClick={() => set(value + 1)}
          aria-label={`Raise ${label}`}
        >
          +
        </button>
      </div>
    </div>
  )
}
