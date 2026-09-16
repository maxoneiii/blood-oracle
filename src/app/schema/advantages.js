import { MODULE_ID } from '../../constants.js'

/**
 * Merits, flaws and backgrounds are all `feature` items in wod5e, separated by
 * `system.featuretype`. Ratings live in `system.points`.
 *
 * Blood Oracle keeps the rating as free text in its catalogue ("2", "1-2",
 * "1 per language"), because the book does. That text is the authoritative
 * range and stays in flags; `points` holds the rating the character actually
 * bought, which is what other modules and macros can use.
 */

export const FEATURE_TYPES = {
  merit: 'merit',
  flaw: 'flaw',
  background: 'background'
}

/** The catalogue's Backgrounds group belongs to its own feature type. */
export function featureTypeFor(entry) {
  if (entry?.group === 'Backgrounds') return FEATURE_TYPES.background
  return entry?.kind === 'flaw' ? FEATURE_TYPES.flaw : FEATURE_TYPES.merit
}

export function featuresOfType(actor, featuretype) {
  return actor.items
    .filter((item) => item.type === 'feature' && (item.system.featuretype || 'background') === featuretype)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function readAdvantageMeta(item) {
  return item.getFlag(MODULE_ID, 'advantage') ?? {}
}

export function buildFeatureData({ name, featuretype, points = 0, description = '', meta = {} }) {
  return {
    name: String(name ?? '').trim() || 'New feature',
    type: 'feature',
    system: {
      featuretype,
      points: Number(points) || 0,
      description
    },
    flags: { [MODULE_ID]: { advantage: meta } }
  }
}

/** Create a feature from a catalogue entry, or a blank one for homebrew. */
export async function addFeature(actor, { entry, featuretype }) {
  const type = entry ? featureTypeFor(entry) : featuretype

  // A fixed-price merit arrives at its price; a range starts at its minimum.
  const range = entry ? dotsRange(entry.dots) : null

  const data = buildFeatureData({
    name: entry?.name ?? '',
    featuretype: type,
    points: range ? range.min : 0,
    description: entry?.description ?? '',
    meta: entry
      ? {
          group: entry.group,
          dots: entry.dots,
          hasDetails: entry.hasDetails,
          detailsPlaceholder: entry.detailsPlaceholder,
          details: ''
        }
      : {}
  })

  const [created] = await actor.createEmbeddedDocuments('Item', [data])
  return created
}

/** Free-text detail some features carry — languages spoken, who the Ally is. */
export async function setDetails(item, details) {
  const meta = readAdvantageMeta(item)
  await item.setFlag(MODULE_ID, 'advantage', { ...meta, details })
}

/**
 * Read the catalogue's rating text into a range the sheet can enforce.
 *
 * Most merits cost a fixed amount — "2" means two dots, not up to two — so
 * those are not editable. Ranges like "1-3" or "2 or 4" are a choice and stay
 * editable. Open-ended forms, "1+" and "1 per language", have no ceiling.
 */
export function dotsRange(dots) {
  const text = String(dots ?? '').trim()
  const numbers = (text.match(/\d+/g) ?? []).map(Number)
  const open = /\+|\bper\b/i.test(text)

  if (!numbers.length) return { min: 0, max: 5, fixed: false, open: true }

  const min = Math.min(...numbers)
  const max = open ? 5 : Math.max(...numbers)

  return {
    min,
    max,
    // A single number with no range marker and no open-ended wording is a price.
    fixed: !open && numbers.length === 1,
    open
  }
}

/** Kept for the dot tracker, which only needs the ceiling. */
export function maximumFromDots(dots) {
  return dotsRange(dots).max
}
