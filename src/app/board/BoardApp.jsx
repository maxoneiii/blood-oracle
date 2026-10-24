import { Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import Select from '../components/Select.jsx'
import {
  CARD_WIDTH,
  PALETTES,
  readPalette,
  setPalette,
  visibleBoard,
  addCard,
  updateCard,
  removeCard,
  connect,
  updateConnection,
  removeConnection,
  setCardPrivacy
} from './board.js'

// The SVG plane is offset so cards at negative coordinates still render.
const WORLD_OFFSET = 100000
const ZOOM_MIN = 0.3
const ZOOM_MAX = 2.4

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" style={{ display: 'block' }}>
      <path
        d="M10.5 4l1.5 1.5-4.5 4.5-2 .5.5-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" style={{ display: 'block' }}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" fill="none" stroke="currentColor" />
      <circle cx="5" cy="6" r="1.2" fill="currentColor" />
      <path d="M2 12.5l3.5-3.5 2.5 2.5 3-3 3 3" fill="none" stroke="currentColor" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" style={{ display: 'block' }}>
      <circle cx="3.5" cy="12.5" r="2" fill="none" stroke="currentColor" />
      <circle cx="12.5" cy="3.5" r="2" fill="none" stroke="currentColor" />
      <path d="M5 11l6-6" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.6" />
    </svg>
  )
}

function EyeIcon({ open }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" style={{ display: 'block' }}>
      <path d="M1 8s2.5-4 7-4 7 4 7 4-2.5 4-7 4-7-4-7-4z" fill="none" stroke="currentColor" />
      <circle cx="8" cy="8" r="1.8" fill="currentColor" />
      {open ? null : <path d="M2 14L14 2" stroke="currentColor" strokeWidth="1.4" />}
    </svg>
  )
}

export default function BoardApp({ store }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)

  // Every hook runs before the empty-snapshot guard below: bailing out early
  // would change the hook count between renders, which React forbids.
  const journal = snapshot?.journal ?? null
  const editable = snapshot?.editable ?? false
  const isGM = snapshot?.isGM ?? false
  const userId = snapshot?.userId ?? null
  const viewer = { userId, isGM }

  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  // The card a line is being drawn from, while it is being drawn.
  const [pending, setPending] = useState(null)
  // Where the loose end of that line is, in board coordinates, and the card
  // under it — the line snaps to that card's centre.
  const [linkCursor, setLinkCursor] = useState(null)
  const [linkTarget, setLinkTarget] = useState(null)
  // The line under the pointer, which shows its controls: a × at each end to
  // remove it, a + in the middle to give it a label.
  const [hoveredLink, setHoveredLink] = useState(null)
  // The line whose label is being typed.
  const [editingLabel, setEditingLabel] = useState(null)
  const hoverTimerRef = useRef(null)
  const [dragging, setDragging] = useState(null)
  const [editingIds, setEditingIds] = useState(() => new Set())
  const [, setSizeTick] = useState(0)

  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  const viewportRef = useRef(null)
  const cardRefs = useRef({})
  const sizesRef = useRef({})
  const fileTargetRef = useRef(null)
  // Pointer listeners outlive renders, so they read the drawing state here.
  const pendingRef = useRef(null)
  // The card whose next click belongs to the line just ended on it.
  const swallowClickRef = useRef(null)
  const journalRef = useRef(null)
  journalRef.current = journal

  const { cards, connections, hiddenCount } = journal
    ? visibleBoard(journal, viewer)
    : { cards: [], connections: [], hiddenCount: 0 }

  const applyView = (nextPan, nextZoom) => {
    panRef.current = nextPan
    zoomRef.current = nextZoom
    setPan(nextPan)
    setZoom(nextZoom)
  }

  // Card heights vary with their content, and the lines are drawn between
  // centres, so the rendered boxes have to be measured rather than assumed.
  useLayoutEffect(() => {
    let changed = false
    for (const card of cards) {
      const element = cardRefs.current[card.id]
      if (!element) continue
      const size = { w: element.offsetWidth, h: element.offsetHeight }
      const previous = sizesRef.current[card.id]
      if (!previous || previous.w !== size.w || previous.h !== size.h) {
        sizesRef.current[card.id] = size
        changed = true
      }
    }
    if (changed) setSizeTick((tick) => tick + 1)
  })

  // Escape abandons a line being drawn, or lets go of a selected one.
  useEffect(() => {
    if (!pending) return
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      endLink()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [pending])

  useEffect(() => () => clearTimeout(hoverTimerRef.current), [])

  // While a line is being drawn its loose end follows the pointer.
  useEffect(() => {
    if (!pending) return
    const onMove = (event) => {
      setLinkCursor(toWorld(event.clientX, event.clientY))
      const target = cardAt(event.clientX, event.clientY)
      setLinkTarget(target && target !== pendingRef.current ? target : null)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [pending])

  // Wheel zoom towards the cursor. Registered non-passively so the page does
  // not scroll underneath the board.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onWheel = (event) => {
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const currentZoom = zoomRef.current
      const currentPan = panRef.current
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12
      const nextZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, currentZoom * factor))
      const wx = (px - currentPan.x) / currentZoom
      const wy = (py - currentPan.y) / currentZoom
      applyView({ x: px - wx * nextZoom, y: py - wy * nextZoom }, nextZoom)
    }

    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [])

  /* ------------------------------------------------------------- pointer */

  const startPan = (event) => {
    if (pendingRef.current) {
      endLink()
      return
    }
    const sx = event.clientX
    const sy = event.clientY
    const origin = { ...panRef.current }

    const move = (moveEvent) =>
      applyView(
        { x: origin.x + (moveEvent.clientX - sx), y: origin.y + (moveEvent.clientY - sy) },
        zoomRef.current
      )
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const startCardDrag = (event, card) => {
    if (!editable) return
    event.stopPropagation()
    event.preventDefault()

    const sx = event.clientX
    const sy = event.clientY
    const scale = zoomRef.current
    setDragging({ id: card.id, x: card.x, y: card.y })

    const move = (moveEvent) =>
      setDragging({
        id: card.id,
        x: card.x + (moveEvent.clientX - sx) / scale,
        y: card.y + (moveEvent.clientY - sy) / scale
      })

    const up = (upEvent) => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      setDragging(null)
      updateCard(journal, card.id, {
        x: card.x + (upEvent.clientX - sx) / scale,
        y: card.y + (upEvent.clientY - sy) / scale
      })
    }

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  /* -------------------------------------------------------------- linking */

  const toWorld = (clientX, clientY) => {
    const rect = viewportRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current
    }
  }

  /** The id of the card under a screen point, if it is one of this board's. */
  const cardAt = (clientX, clientY) => {
    const element = document.elementFromPoint(clientX, clientY)
    if (!element || !viewportRef.current?.contains(element)) return null
    return element.closest('[data-board-card]')?.dataset.boardCard ?? null
  }

  const endLink = () => {
    pendingRef.current = null
    setPending(null)
    setLinkCursor(null)
    setLinkTarget(null)
  }

  /** Keep a line's controls up while the pointer is on the line or on them. */
  const hoverLink = (id) => {
    clearTimeout(hoverTimerRef.current)
    setHoveredLink(id)
  }
  const unhoverLink = () => {
    clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setHoveredLink(null), 220)
  }

  /**
   * Pressing the link button starts a line at once. Dragging and letting go
   * over a card connects there; a plain click leaves the line following the
   * pointer until any card is clicked.
   */
  const beginLink = (event, card) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()

    setHoveredLink(null)
    pendingRef.current = card.id
    setPending(card.id)
    setLinkCursor(toWorld(event.clientX, event.clientY))

    const sx = event.clientX
    const sy = event.clientY
    const up = (upEvent) => {
      window.removeEventListener('mouseup', up)
      if (pendingRef.current !== card.id) return
      const moved = Math.hypot(upEvent.clientX - sx, upEvent.clientY - sy) > 6
      if (!moved) return
      const target = cardAt(upEvent.clientX, upEvent.clientY)
      if (target && target !== card.id) connect(journalRef.current, card.id, target)
      endLink()
    }
    window.addEventListener('mouseup', up)
  }

  /**
   * While a line is out, a press anywhere on a card — title, text, picture or
   * buttons — ends it there. Captured before the card's own handlers, which
   * would otherwise start a drag or an edit and swallow the press.
   */
  const finishLinkOn = (event, card) => {
    const from = pendingRef.current
    if (!from) return
    event.stopPropagation()
    event.preventDefault()
    swallowClickRef.current = card.id
    // If no click follows (the pointer slid off before release), forget it.
    const clear = () => {
      window.removeEventListener('mouseup', clear, true)
      setTimeout(() => {
        swallowClickRef.current = null
      }, 0)
    }
    window.addEventListener('mouseup', clear, true)
    if (from !== card.id) connect(journal, from, card.id)
    endLink()
  }

  /* ------------------------------------------------------------ geometry */

  const positionOf = (card) =>
    dragging && dragging.id === card.id ? { x: dragging.x, y: dragging.y } : { x: card.x, y: card.y }

  const centreOf = (card) => {
    const position = positionOf(card)
    const size = sizesRef.current[card.id] ?? { w: CARD_WIDTH, h: 100 }
    return { x: position.x + size.w / 2, y: position.y + size.h / 2 }
  }

  /**
   * Where the line from `card` towards `point` leaves the card, pushed a little
   * further out — the spot for that end's × button.
   */
  const lineEnd = (card, point, gap = 16) => {
    const centre = centreOf(card)
    const size = sizesRef.current[card.id] ?? { w: CARD_WIDTH, h: 100 }
    const dx = point.x - centre.x
    const dy = point.y - centre.y
    const length = Math.hypot(dx, dy) || 1
    const ux = dx / length
    const uy = dy / length
    const toEdge = Math.min(
      Math.abs(ux) > 1e-6 ? size.w / 2 / Math.abs(ux) : Infinity,
      Math.abs(uy) > 1e-6 ? size.h / 2 / Math.abs(uy) : Infinity
    )
    return { x: centre.x + ux * (toEdge + gap), y: centre.y + uy * (toEdge + gap) }
  }

  const cardsById = {}
  for (const card of cards) cardsById[card.id] = card

  /* ------------------------------------------------------------- actions */

  const create = async () => {
    const viewport = viewportRef.current
    const width = viewport?.clientWidth ?? 800
    const height = viewport?.clientHeight ?? 520
    const scale = zoomRef.current
    const current = panRef.current
    const jitter = (cards.length % 5) * 22

    const card = await addCard(journal, {
      x: (width / 2 - current.x) / scale - CARD_WIDTH / 2 + jitter,
      y: (height / 2 - current.y) / scale - 60 + jitter,
      userId
    })

    setEditingIds((ids) => new Set(ids).add(card.id))
  }

  const pickImage = async (card) => {
    fileTargetRef.current = card.id
    const picker = new foundry.applications.apps.FilePicker.implementation({
      type: 'image',
      current: card.image || '',
      callback: (path) => updateCard(journal, card.id, { image: path })
    })
    await picker.browse()
  }

  const confirmRemoveCard = async (card) => {
    const named = card.title?.trim() || 'this card'
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      classes: ['blood-oracle', 'bo-dialog'],
      window: { title: 'Remove card' },
      content: `<p>Remove <strong>${foundry.utils.escapeHTML(named)}</strong> and every line drawn to it?</p>`
    })
    if (confirmed) await removeCard(journal, card.id)
  }

  const toggleEdit = (id) =>
    setEditingIds((ids) => {
      const next = new Set(ids)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  /* -------------------------------------------------------------- render */

  if (!journal) return null

  return (
    <div className={`bo-app bo-board ${readPalette(journal)}`}>
      <div className="bo-board-bar">
        {editable ? (
          <button type="button" className="bo-header-button" onClick={create}>
            + Add card
          </button>
        ) : null}

        {pending ? (
          <span className="bo-board-hint">
            Click any card to connect, or drag onto it — Escape or click the board to cancel.
          </span>
        ) : null}

        <div style={{ flex: 1 }} />

        {hiddenCount > 0 ? (
          <span className="bo-board-hidden">
            {hiddenCount} private card{hiddenCount > 1 ? 's' : ''} not shown to you
          </span>
        ) : null}

        <div className="bo-board-zoom">
          <button
            type="button"
            className="bo-mini"
            onClick={() => applyView(panRef.current, Math.max(ZOOM_MIN, zoomRef.current / 1.15))}
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="bo-mini"
            onClick={() => applyView(panRef.current, Math.min(ZOOM_MAX, zoomRef.current * 1.15))}
          >
            +
          </button>
          <button type="button" className="bo-mini" title="Reset view" onClick={() => applyView({ x: 0, y: 0 }, 1)}>
            ⤢
          </button>
        </div>

        {editable ? (
          <div className="bo-board-palette">
            <Select
              value={readPalette(journal)}
              title="Colour scheme for this board"
              options={PALETTES.map((entry) => ({ value: entry.id, label: entry.label }))}
              onChange={(value) => setPalette(journal, value)}
            />
          </div>
        ) : null}
      </div>

      <div
        className={pending ? 'bo-board-viewport is-linking' : 'bo-board-viewport'}
        ref={viewportRef}
        onMouseDown={startPan}
      >
        <div
          className="bo-board-plane"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {/* Lines sit under the cards, so a card can be dragged over one. */}
          <svg className="bo-board-links" width={WORLD_OFFSET * 2} height={WORLD_OFFSET * 2}>
            {connections.map((link) => {
              const from = cardsById[link.from]
              const to = cardsById[link.to]
              if (!from || !to) return null

              const a = centreOf(from)
              const b = centreOf(to)
              const ends = {
                x1: a.x + WORLD_OFFSET,
                y1: a.y + WORLD_OFFSET,
                x2: b.x + WORLD_OFFSET,
                y2: b.y + WORLD_OFFSET
              }

              return (
                <g key={link.id} className={hoveredLink === link.id ? 'bo-link is-hovered' : 'bo-link'}>
                  <line className="bo-link-line" {...ends} />
                  {/* A wide invisible stroke over the thin one, so the line is
                      easy to hover. Not while another line is being drawn. */}
                  {editable && !pending ? (
                    <line
                      className="bo-link-hit"
                      {...ends}
                      onMouseEnter={() => hoverLink(link.id)}
                      onMouseLeave={unhoverLink}
                      onMouseDown={(event) => event.stopPropagation()}
                    />
                  ) : null}
                </g>
              )
            })}

            {pending && linkCursor && cardsById[pending]
              ? (() => {
                  const a = centreOf(cardsById[pending])
                  const b = linkTarget && cardsById[linkTarget] ? centreOf(cardsById[linkTarget]) : linkCursor
                  return (
                    <line
                      className="bo-link-draft"
                      x1={a.x + WORLD_OFFSET}
                      y1={a.y + WORLD_OFFSET}
                      x2={b.x + WORLD_OFFSET}
                      y2={b.y + WORLD_OFFSET}
                    />
                  )
                })()
              : null}
          </svg>

          {/* Per line: its label, if it has one or is getting one; and, while
              hovered, a × at each end and a + in the middle for a new label. */}
          {connections.map((link) => {
            const from = cardsById[link.from]
            const to = cardsById[link.to]
            if (!from || !to) return null

            const a = centreOf(from)
            const b = centreOf(to)
            const mid = { left: `${(a.x + b.x) / 2}px`, top: `${(a.y + b.y) / 2}px` }
            const label = link.label?.trim() ?? ''
            const isEditing = editable && editingLabel === link.id
            const showControls = editable && !pending && hoveredLink === link.id
            const keepHover = {
              onMouseEnter: () => hoverLink(link.id),
              onMouseLeave: unhoverLink,
              onMouseDown: (event) => event.stopPropagation()
            }

            const pieces = []

            if (isEditing) {
              pieces.push(
                <div key="edit" className="bo-link-label is-editing" style={mid} {...keepHover}>
                  <input
                    type="text"
                    defaultValue={link.label ?? ''}
                    placeholder="label"
                    autoFocus
                    onBlur={(event) => {
                      const next = event.target.value.trim()
                      setEditingLabel(null)
                      if (next !== label) updateConnection(journal, link.id, { label: next })
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                      if (event.key === 'Escape') {
                        event.stopPropagation()
                        event.currentTarget.value = link.label ?? ''
                        event.currentTarget.blur()
                      }
                    }}
                  />
                </div>
              )
            } else if (label) {
              pieces.push(
                <div key="label" className="bo-link-label is-static" style={mid} {...keepHover}>
                  <span
                    className={editable ? 'bo-link-text is-clickable' : 'bo-link-text'}
                    title={editable ? 'Click to edit the label' : undefined}
                    onClick={editable ? () => setEditingLabel(link.id) : undefined}
                  >
                    {label}
                  </span>
                  {editable ? (
                    <button
                      type="button"
                      className="bo-link-label-remove"
                      title="Remove the label (the line stays)"
                      onClick={() => updateConnection(journal, link.id, { label: '' })}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              )
            } else if (showControls) {
              pieces.push(
                <button
                  key="add"
                  type="button"
                  className="bo-link-control is-add"
                  style={mid}
                  title="Add a label"
                  {...keepHover}
                  onClick={() => setEditingLabel(link.id)}
                >
                  +
                </button>
              )
            }

            if (showControls) {
              for (const [key, end] of [
                ['from', lineEnd(from, b)],
                ['to', lineEnd(to, a)]
              ]) {
                pieces.push(
                  <button
                    key={key}
                    type="button"
                    className="bo-link-control is-remove"
                    style={{ left: `${end.x}px`, top: `${end.y}px` }}
                    title="Remove this line"
                    {...keepHover}
                    onClick={() => {
                      setHoveredLink(null)
                      removeConnection(journal, link.id)
                    }}
                  >
                    ×
                  </button>
                )
              }
            }

            return pieces.length ? <Fragment key={link.id}>{pieces}</Fragment> : null
          })}

          {cards.map((card) => {
            const position = positionOf(card)
            const isEditing = editingIds.has(card.id)
            const isPending = pending === card.id

            return (
              <div
                key={card.id}
                ref={(element) => {
                  cardRefs.current[card.id] = element
                }}
                data-board-card={card.id}
                className={[
                  'bo-card',
                  card.private ? 'is-private' : '',
                  isPending ? 'is-pending' : '',
                  linkTarget === card.id ? 'is-link-target' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ left: `${position.x}px`, top: `${position.y}px`, width: `${CARD_WIDTH}px` }}
                onMouseDownCapture={(event) => finishLinkOn(event, card)}
                // The press that ended a line must not also click the button
                // under it — a card's × would remove the card.
                onClickCapture={(event) => {
                  if (swallowClickRef.current !== card.id) return
                  swallowClickRef.current = null
                  event.stopPropagation()
                  event.preventDefault()
                }}
                onMouseDown={(event) => event.stopPropagation()}
              >
                {/* Tools above, title below: side by side the buttons left the
                    title a sliver, and titles are what you read the board by. */}
                {editable ? (
                  <div className="bo-card-tools" onMouseDown={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className={card.private ? 'bo-mini is-private' : 'bo-mini is-public'}
                      title={card.private ? 'Private — click to publish' : 'Visible to everyone'}
                      onClick={() => setCardPrivacy(journal, card, !card.private, viewer)}
                    >
                      <EyeIcon open={!card.private} />
                    </button>
                    <button
                      type="button"
                      className="bo-mini"
                      title={isEditing ? 'Done' : 'Edit'}
                      onClick={() => toggleEdit(card.id)}
                    >
                      {isEditing ? '✓' : <EditIcon />}
                    </button>
                    <button type="button" className="bo-mini" title="Image" onClick={() => pickImage(card)}>
                      <ImageIcon />
                    </button>
                    <button
                      type="button"
                      className={isPending ? 'bo-mini is-active' : 'bo-mini'}
                      title="Draw a line from this card — drag it onto another card, or click and then click one"
                      onMouseDown={(event) => beginLink(event, card)}
                    >
                      <LinkIcon />
                    </button>
                    <button
                      type="button"
                      className="bo-mini"
                      title="Remove"
                      onClick={() => confirmRemoveCard(card)}
                    >
                      ×
                    </button>
                  </div>
                ) : null}

                <div
                  className="bo-card-head"
                  onMouseDown={(event) => (isEditing ? event.stopPropagation() : startCardDrag(event, card))}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      className="bo-card-title"
                      defaultValue={card.title}
                      placeholder="Block title"
                      onMouseDown={(event) => event.stopPropagation()}
                      onBlur={(event) => updateCard(journal, card.id, { title: event.target.value })}
                      key={card.title}
                    />
                  ) : (
                    <span className="bo-card-title is-static">
                      {card.title?.trim() || <span className="bo-placeholder">Untitled</span>}
                    </span>
                  )}
                </div>

                {card.image ? <img src={card.image} alt="" className="bo-card-image" /> : null}

                {isEditing ? (
                  <textarea
                    className="bo-card-body"
                    rows={4}
                    defaultValue={card.body}
                    placeholder="Notes, evidence, hunches…"
                    onMouseDown={(event) => event.stopPropagation()}
                    onBlur={(event) => updateCard(journal, card.id, { body: event.target.value })}
                    key={card.body}
                  />
                ) : (
                  <div className="bo-card-body is-static">
                    {card.body?.trim() || <span className="bo-placeholder">Empty — click the pencil to write.</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {!cards.length ? (
          <p className="bo-board-empty">
            {hiddenCount > 0
              ? 'Nothing here you can see yet.'
              : 'The board is bare. Add a card to begin the investigation…'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
