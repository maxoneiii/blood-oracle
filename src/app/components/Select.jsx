import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { paletteOf, placement } from './floating.js'

/**
 * A dropdown drawn in the sheet's own style, replacing the native <select>,
 * whose open list is painted by the browser in grey.
 *
 *   <Select value onChange={(value) => …} options={[…]} placeholder disabled />
 *
 * An option is { value, label, group?, hint?, muted?, disabled? }. Options are
 * shown in the order given; a heading appears wherever `group` changes. A
 * muted option is still selectable — it is for "possible but unusual".
 *
 * The open list is portalled to <body> so a scrolling Foundry window cannot
 * clip it. Out there it would lose the sheet's palette, so the palette
 * variables are copied from the trigger, which keeps a ghoul's or a pack's
 * colours intact.
 */

const SEARCH_FROM = 12

const norm = (value) => String(value ?? '').toLowerCase()

export default function Select({
  value,
  onChange,
  options,
  placeholder = '—',
  disabled = false,
  searchable,
  className = '',
  title
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [layout, setLayout] = useState(null)

  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const searchRef = useRef(null)

  const withSearch = searchable ?? options.length >= SEARCH_FROM
  const current = options.find((option) => option.value === value) ?? null

  const filtered = useMemo(() => {
    const needle = norm(query).trim()
    if (!needle) return options
    return options.filter(
      (option) => norm(option.label).includes(needle) || norm(option.group).includes(needle)
    )
  }, [options, query])

  const close = (refocus = true) => {
    setOpen(false)
    setQuery('')
    setActive(-1)
    if (refocus) triggerRef.current?.focus()
  }

  const choose = (option) => {
    if (!option || option.disabled) return
    close()
    if (option.value !== value) onChange(option.value)
  }

  const openMenu = () => {
    if (disabled || !triggerRef.current) return
    setLayout({ position: placement(triggerRef.current), palette: paletteOf(triggerRef.current) })
    setActive(Math.max(0, options.findIndex((option) => option.value === value)))
    setOpen(true)
  }

  // Focus the search box, or the list, once the menu is on screen.
  useLayoutEffect(() => {
    if (!open) return
    if (withSearch) searchRef.current?.focus()
    else menuRef.current?.focus()
  }, [open, withSearch])

  // Keep the highlighted row in view while moving with the keyboard.
  useEffect(() => {
    if (!open || active < 0) return
    menuRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  // Close on a click elsewhere, on Escape, and when anything around it moves.
  useEffect(() => {
    if (!open) return

    const onPointer = (event) => {
      if (menuRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return
      close(false)
    }
    const onScroll = (event) => {
      if (menuRef.current?.contains(event.target)) return
      close(false)
    }
    const onResize = () => close(false)
    // Window capture runs before the document-level listeners that close a
    // modal or the sheet, so Escape closes only this list.
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      event.preventDefault()
      close()
    }

    document.addEventListener('mousedown', onPointer, true)
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onPointer, true)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const move = (step) => {
    if (!filtered.length) return
    let next = active
    for (let i = 0; i < filtered.length; i++) {
      next = (next + step + filtered.length) % filtered.length
      if (!filtered[next].disabled) break
    }
    setActive(next)
  }

  const onMenuKey = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(filtered[active])
    } else if (event.key === 'Tab') {
      close(false)
    }
  }

  const onTriggerKey = (event) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openMenu()
    }
  }

  let lastGroup = null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={['bo-select', open ? 'is-open' : '', className].filter(Boolean).join(' ')}
        disabled={disabled}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKey}
      >
        <span className={current ? 'bo-select-value' : 'bo-select-value is-placeholder'}>
          {current ? current.label : placeholder}
        </span>
        <span className="bo-select-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && layout
        ? createPortal(
            <div
              ref={menuRef}
              className="bo-select-menu"
              role="listbox"
              tabIndex={-1}
              style={{ ...layout.palette, ...layout.position }}
              onKeyDown={onMenuKey}
            >
              {withSearch ? (
                <input
                  ref={searchRef}
                  type="text"
                  className="bo-select-search"
                  value={query}
                  placeholder="Search…"
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setActive(0)
                  }}
                />
              ) : null}

              <div className="bo-select-options">
                {filtered.map((option, index) => {
                  const heading = option.group && option.group !== lastGroup ? option.group : null
                  lastGroup = option.group ?? null
                  const classes = ['bo-select-option']
                  if (option.value === value) classes.push('is-current')
                  if (index === active) classes.push('is-active')
                  if (option.muted) classes.push('is-muted')
                  if (option.disabled) classes.push('is-disabled')

                  return (
                    <div key={`${option.group ?? ''}|${option.value}`}>
                      {heading ? <div className="bo-select-group">{heading}</div> : null}
                      <div
                        role="option"
                        aria-selected={option.value === value}
                        aria-disabled={option.disabled || undefined}
                        data-index={index}
                        className={classes.join(' ')}
                        onMouseEnter={() => setActive(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choose(option)}
                      >
                        <span>{option.label}</span>
                        {option.hint ? <span className="bo-select-hint">{option.hint}</span> : null}
                      </div>
                    </div>
                  )
                })}
                {!filtered.length ? <div className="bo-select-empty">Nothing matches that.</div> : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
