/**
 * Attribute and skill keys come from wod5e's own definition classes, not from a
 * local list. That keeps us in step with renamed traits, custom traits added
 * through world settings, and any traits contributed by other modules.
 */

const TYPE_ORDER = ['physical', 'social', 'mental']

function readList(definitionClass) {
  // `disableSort: true` keeps the definition order, which is the order the
  // books use: Strength/Dexterity/Stamina rather than alphabetical, and skills
  // alphabetical within each category.
  const list = definitionClass.getList({ disableSort: true }) ?? {}
  return Object.entries(list).map(([id, value]) => ({
    id,
    type: value.type ?? 'physical',
    label: value.displayName || game.i18n.localize(value.label ?? id)
  }))
}

function group(entries, pathPrefix) {
  const byType = new Map(TYPE_ORDER.map((t) => [t, []]))

  for (const entry of entries) {
    if (!byType.has(entry.type)) byType.set(entry.type, [])
    byType.get(entry.type).push({ ...entry, path: `${pathPrefix}.${entry.id}.value` })
  }

  return TYPE_ORDER.filter((t) => byType.get(t)?.length).map((t) => ({
    type: t,
    // The system files these three labels under its SPC namespace; there is no
    // separate top-level key for them.
    label: game.i18n.localize(`WOD5E.SPC.${t.charAt(0).toUpperCase() + t.slice(1)}`),
    entries: byType.get(t)
  }))
}

export function getAttributeGroups() {
  return group(readList(WOD5E.Attributes), 'system.attributes')
}

export function getSkillGroups() {
  return group(readList(WOD5E.Skills), 'system.skills')
}

/** Reads a dotted path off an actor, tolerating traits the actor has never set. */
export function readTrait(actor, path) {
  return foundry.utils.getProperty(actor, path) ?? 0
}
