/**
 * What each kind of character has, and what it looks like.
 *
 * wod5e gives mortals, ghouls and vampires the same data model, so the
 * difference is entirely in what is worth showing. A mortal has no Blood and no
 * Disciplines; a ghoul has borrowed Disciplines and a Humanity to lose, but no
 * Hunger of its own — the system forces that to zero — and no Blood Potency,
 * clan Bane or Resonance, all of which belong to the Blood it does not have.
 */

export const SPLATS = {
  vampire: {
    label: 'Vampire',
    tabs: ['bio', 'stats', 'blood', 'disciplines', 'merits', 'inventory', 'notes'],
    hunger: true,
    potency: true,
    resonance: true,
    clanBane: true,
    rouse: true,
    resistFrenzy: true,
    remorse: true
  },
  ghoul: {
    label: 'Ghoul',
    // Disciplines stay: a ghoul's domitor grants them, usually at one dot.
    tabs: ['bio', 'stats', 'blood', 'disciplines', 'merits', 'inventory', 'notes'],
    hunger: false,
    potency: false,
    resonance: false,
    clanBane: false,
    rouse: false,
    // Ghouls can frenzy, and it is one of the reasons they are dangerous.
    resistFrenzy: true,
    // The system gives ghouls a Remorse roll too.
    remorse: true
  },
  // Story characters stand in for anyone the Storyteller needs. Their own type
  // is chosen on the actor (`system.spcType`), so the sheet stays neutral and
  // shows the Blood tab only when that type calls for it.
  spc: {
    label: 'Story character',
    tabs: ['bio', 'stats', 'disciplines', 'merits', 'inventory', 'notes'],
    hunger: false,
    potency: false,
    resonance: false,
    clanBane: false,
    rouse: false,
    resistFrenzy: false
  },
  mortal: {
    label: 'Mortal',
    tabs: ['bio', 'stats', 'merits', 'inventory', 'notes'],
    hunger: false,
    potency: false,
    resonance: false,
    clanBane: false,
    rouse: false,
    resistFrenzy: false
  }
}

export function splatOf(actor) {
  return SPLATS[actor?.type] ?? SPLATS.mortal
}

/** Class applied to the sheet root so the palette can shift per splat. */
export function splatClass(actor) {
  return `bo-splat-${actor?.type ?? 'mortal'}`
}
