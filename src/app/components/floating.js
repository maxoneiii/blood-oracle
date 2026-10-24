/**
 * Shared by everything the sheet draws outside its own window: the dropdown
 * list, the specialty popover and tooltips. They are portalled to <body> so a
 * scrolling Foundry window cannot clip them, and out there they would lose the
 * sheet's palette, so the palette variables are copied from the anchor —
 * which keeps a ghoul's or a pack's colours intact.
 */

export const PALETTE_VARS = [
  '--bo-text', '--bo-text-dim', '--bo-text-muted', '--bo-text-faint',
  '--bo-accent', '--bo-accent-red', '--bo-field-bg', '--bo-field-border',
  '--bo-panel-border', '--bo-rule', '--bo-edge', '--bo-modal-bg',
  '--bo-red-glow', '--bo-size-note'
]

export function paletteOf(element) {
  const computed = getComputedStyle(element)
  const style = { fontFamily: computed.fontFamily }
  for (const name of PALETTE_VARS) {
    const value = computed.getPropertyValue(name)
    if (value) style[name] = value.trim()
  }
  return style
}

/**
 * Fixed-position box under the anchor, or above it when there is clearly more
 * room there, kept inside the viewport horizontally.
 */
export function placement(anchor, { minWidth = 220, maxHeight = 320, needBelow = 220 } = {}) {
  const rect = anchor.getBoundingClientRect()
  const below = window.innerHeight - rect.bottom - 8
  const above = rect.top - 8
  const openUp = below < needBelow && above > below
  const width = Math.max(rect.width, minWidth)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))

  return openUp
    ? { left, width, bottom: window.innerHeight - rect.top + 2, maxHeight: Math.min(maxHeight, above) }
    : { left, width, top: rect.bottom + 2, maxHeight: Math.min(maxHeight, below) }
}
