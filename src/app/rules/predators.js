/**
 * Predator type grants, transcribed by hand from Blood Oracle's PREDATOR_GRANTS
 * into an explicit structure. These are game mechanics, not book text, so the
 * table ships with the module and works without the rules reference.
 *
 * A predator is a list of blocks. Every block is one of three primitives:
 *
 *   fixed(grant)                       granted as is
 *   choose(label, [grant, ...])        pick exactly one option
 *   spread(label, dots, [grant, ...])  distribute `dots` among the targets;
 *                                      targets carry no dots of their own
 *
 * A grant is one of:
 *
 *   { kind: 'specialty',  skill, text }           text: '' → player writes it,
 *                                                 prompt says what to write
 *   { kind: 'discipline', key, clans? }           clans: in-clan restriction,
 *                                                 shown muted, never blocked
 *   { kind: 'humanity',   delta }
 *   { kind: 'potency',    delta }
 *   { kind: 'background', name, dots, detail? }
 *   { kind: 'merit',      name, dots, detail? }
 *   { kind: 'flaw',       name, dots, detail? }   name: null → player names it
 *
 * Any grant may carry `hint`: a note shown in the dialog only, never stored.
 *
 * `name` for backgrounds, merits and flaws is the catalogue entry name, so an
 * applied grant links up with the catalogue description when the rules
 * reference is installed. `detail` lands in the feature's details flag.
 *
 * Skill and discipline keys are wod5e identifiers.
 */

const sp = (skill, text, prompt) => ({ kind: 'specialty', skill, text: text ?? '', ...(prompt ? { prompt } : {}) })
const disc = (key, clans) => ({ kind: 'discipline', key, ...(clans ? { clans } : {}) })
const humanity = (delta) => ({ kind: 'humanity', delta })
const potency = (delta) => ({ kind: 'potency', delta })
const bg = (name, dots, detail) => ({ kind: 'background', name, dots, ...(detail ? { detail } : {}) })
const merit = (name, dots, detail) => ({ kind: 'merit', name, dots, ...(detail ? { detail } : {}) })
const flaw = (name, dots, detail, prompt) => ({ kind: 'flaw', name, dots, ...(detail ? { detail } : {}), ...(prompt ? { prompt } : {}) })

const fixed = (grant) => ({ type: 'fixed', grant })
const choose = (label, options) => ({ type: 'choose', label, options })
const spread = (label, dots, targets) => ({ type: 'spread', label, dots, targets })

const SPECIALTY = 'Specialty'
const DISCIPLINE = 'Discipline (one dot)'

export const PREDATORS = {
  alleycat: {
    name: 'Alleycat',
    source: 'Corebook, p. 175',
    blocks: [
      choose(SPECIALTY, [sp('intimidation', 'Stickups'), sp('brawl', 'Grappling')]),
      choose(DISCIPLINE, [disc('celerity'), disc('potence')]),
      fixed(humanity(-1)),
      fixed(bg('Contacts', 3, 'Criminal'))
    ]
  },

  bagger: {
    name: 'Bagger',
    source: 'Corebook, p. 175',
    restrictions: [{ clans: ['Ventrue'], note: 'Ventrue cannot pick this Predator Type.' }],
    blocks: [
      choose(SPECIALTY, [sp('larceny', 'Lock Picking'), sp('streetwise', 'Black Market')]),
      choose(DISCIPLINE, [
        disc('sorcery', ['Tremere', 'Banu Haqim']),
        disc('oblivion', ['Hecata']),
        disc('obfuscate')
      ]),
      fixed(merit('Iron Gullet', 3)),
      fixed(flaw('Enemy', 2, 'Someone who wants them hunted'))
    ]
  },

  bloodLeech: {
    name: 'Blood Leech',
    source: 'Corebook, p. 175',
    blocks: [
      choose(SPECIALTY, [sp('brawl', 'Kindred'), sp('stealth', 'Against Kindred')]),
      choose(DISCIPLINE, [disc('celerity'), disc('protean')]),
      fixed(humanity(-1)),
      fixed(potency(1)),
      choose('Flaw', [flaw('Dark Secret', 2, 'Diablerist'), flaw('Shunned', 2)]),
      fixed(flaw('Prey Exclusion', 2, 'Mortals'))
    ]
  },

  cleaver: {
    name: 'Cleaver',
    source: 'Corebook, p. 175',
    blocks: [
      choose(SPECIALTY, [sp('persuasion', 'Gaslighting'), sp('subterfuge', 'Coverups')]),
      choose(DISCIPLINE, [disc('dominate'), disc('animalism')]),
      fixed(bg('Herd', 2)),
      fixed(flaw('Dark Secret', 1, 'Cleaver'))
    ]
  },

  consensualist: {
    name: 'Consensualist',
    source: 'Corebook, p. 175',
    blocks: [
      choose(SPECIALTY, [sp('medicine', 'Phlebotomy'), sp('persuasion', 'Vessels')]),
      choose(DISCIPLINE, [disc('auspex'), disc('fortitude')]),
      fixed(humanity(1)),
      fixed(flaw('Dark Secret', 1, 'Masquerade Breacher')),
      fixed(flaw('Prey Exclusion', 1, 'Non-consenting'))
    ]
  },

  farmer: {
    name: 'Farmer',
    source: 'Corebook, p. 175',
    restrictions: [
      { clans: ['Ventrue'], note: 'Ventrue cannot pick this Predator Type.' },
      { minPotency: 3, note: 'Unavailable at Blood Potency 3 or higher.' }
    ],
    blocks: [
      choose(SPECIALTY, [sp('animalken', '', 'Specific animal'), sp('survival', 'Hunting')]),
      choose(DISCIPLINE, [disc('animalism'), disc('protean')]),
      fixed(humanity(1)),
      fixed(flaw('Farmer', 2))
    ]
  },

  osiris: {
    name: 'Osiris',
    source: 'Corebook, p. 175',
    blocks: [
      choose(SPECIALTY, [
        sp('occult', '', 'Specific tradition'),
        sp('performance', '', 'Specific entertainment field')
      ]),
      choose(DISCIPLINE, [disc('sorcery', ['Tremere', 'Banu Haqim']), disc('presence')]),
      spread('Backgrounds', 3, [bg('Fame'), bg('Herd')]),
      spread('Flaws', 2, [flaw('Enemy'), flaw(null, undefined, undefined, 'Mythic flaw')])
    ]
  },

  sandman: {
    name: 'Sandman',
    source: 'Corebook, p. 175',
    blocks: [
      choose(SPECIALTY, [sp('medicine', 'Anesthetics'), sp('stealth', 'Break-in')]),
      choose(DISCIPLINE, [disc('auspex'), disc('obfuscate')]),
      fixed(bg('Resources', 1))
    ]
  },

  sceneQueen: {
    name: 'Scene Queen',
    source: 'Corebook, p. 175',
    blocks: [
      choose(SPECIALTY, [
        sp('etiquette', '', 'Specific scene'),
        sp('leadership', '', 'Specific scene'),
        sp('streetwise', '', 'Specific scene')
      ]),
      choose(DISCIPLINE, [disc('dominate'), disc('potence')]),
      fixed(bg('Fame', 1)),
      fixed(bg('Contacts', 1)),
      choose('Flaw', [
        flaw('Disliked', 1, 'Outside their subculture'),
        flaw('Prey Exclusion', 1, '', 'A different subculture')
      ])
    ]
  },

  siren: {
    name: 'Siren',
    source: 'Corebook, p. 175',
    blocks: [
      choose(SPECIALTY, [sp('persuasion', 'Seduction'), sp('subterfuge', 'Seduction')]),
      choose(DISCIPLINE, [disc('fortitude'), disc('presence')]),
      fixed(merit('Beautiful', 2)),
      fixed(flaw('Enemy', 1, 'A spurned lover or jealous partner'))
    ]
  },

  extortionist: {
    name: 'Extortionist',
    source: 'Cults of the Blood Gods, p. 197',
    blocks: [
      choose(SPECIALTY, [sp('intimidation', 'Coercion'), sp('larceny', 'Security')]),
      choose(DISCIPLINE, [disc('dominate'), disc('potence')]),
      spread('Backgrounds', 3, [bg('Contacts'), bg('Resources')]),
      fixed(flaw('Enemy', 2, 'Police, or an escaped victim seeking revenge'))
    ]
  },

  graverobber: {
    name: 'Graverobber',
    source: 'Cults of the Blood Gods, p. 198',
    blocks: [
      choose(SPECIALTY, [sp('occult', 'Grave Rituals'), sp('medicine', 'Cadavers')]),
      choose(DISCIPLINE, [disc('fortitude'), disc('oblivion')]),
      fixed(bg('Haven', 1)),
      fixed(merit('Iron Gullet', 3)),
      fixed(flaw('Obvious Predator', 2))
    ]
  },

  roadsideKiller: {
    name: 'Roadside Killer',
    source: 'Let the Streets Run Red, p. 168',
    blocks: [
      choose(SPECIALTY, [sp('survival', 'The road'), sp('investigation', 'Vampire cant')]),
      choose(DISCIPLINE, [disc('fortitude'), disc('protean')]),
      fixed(bg('Herd', 2, 'Migrating')),
      fixed(flaw('Prey Exclusion', 1, 'Locals'))
    ]
  },

  grimReaper: {
    name: 'Grim Reaper',
    source: 'Players Guide, p. 73',
    blocks: [
      choose(SPECIALTY, [sp('awareness', 'Death'), sp('larceny', 'Forgery')]),
      choose(DISCIPLINE, [disc('auspex'), disc('oblivion')]),
      fixed(humanity(1)),
      choose('Background', [bg('Allies', 1, 'Medical community'), bg('Influence', 1, 'Medical community')]),
      fixed(flaw('Prey Exclusion', 1, 'Healthy mortals'))
    ]
  },

  montero: {
    name: 'Montero',
    source: 'Players Guide, p. 73',
    blocks: [
      choose(SPECIALTY, [sp('leadership', 'Hunting Pack'), sp('stealth', 'Stakeout')]),
      choose(DISCIPLINE, [disc('dominate'), disc('obfuscate')]),
      fixed(humanity(-1)),
      fixed(bg('Retainers', 2))
    ]
  },

  pursuer: {
    name: 'Pursuer',
    source: 'Players Guide, p. 74',
    blocks: [
      choose(SPECIALTY, [sp('investigation', 'Profiling'), sp('stealth', 'Shadowing')]),
      choose(DISCIPLINE, [disc('animalism'), disc('auspex')]),
      fixed(humanity(-1)),
      fixed(bg('Contacts', 1, 'Where they hunt')),
      fixed(merit('Bloodhound', 1))
    ]
  },

  trapdoor: {
    name: 'Trapdoor',
    source: 'Players Guide, p. 74',
    blocks: [
      choose(SPECIALTY, [sp('persuasion', 'Marketing'), sp('stealth', 'Ambushes or Traps')]),
      choose(DISCIPLINE, [disc('protean'), disc('obfuscate')]),
      fixed(bg('Haven', 1)),
      choose('Background', [bg('Retainers', 1), bg('Herd', 1), { ...bg('Haven', 1), hint: 'adds to the Haven above' }]),
      choose('Flaw', [flaw('Creepy', 1), flaw('Haunted', 1)])
    ]
  }
}
