import { useState } from 'react'
import InfoIcon from '../components/InfoIcon.jsx'
import { splatOf } from '../splats.js'
import { SectionTitle, LabelledValue, GhostButton } from '../components/primitives.jsx'
import { HumanityTracker, LinearPips } from '../components/Trackers.jsx'
import { bloodPotencyRow } from '../roll/tables.js'
import { remorseCheck } from '../roll/checks.js'
import {
  clanInfo,
  predatorInfo,
  humanityFlaw,
  bloodPotencyRange,
  resonanceOptions
} from '../rules/catalog.js'
import { readSingletonName, readTemperament, setResonance } from '../schema/singletons.js'
import { readJournal, findPredator, confirmRevert, revertGrants } from '../schema/predator-grants.js'
import Select from '../components/Select.jsx'
import PredatorGrantsDialog from '../components/PredatorGrantsDialog.jsx'

/* ------------------------------------------------------------- clan curse */

function ClanBlock({ actor, editable }) {
  const [variant, setVariant] = useState(() => actor.getFlag('blood-oracle', 'baneVariant') ?? false)
  const clan = readSingletonName(actor, 'clan')
  const info = clanInfo(clan)

  const toggleVariant = async (next) => {
    setVariant(next)
    await actor.setFlag('blood-oracle', 'baneVariant', next)
  }

  const baneText = !info
    ? ''
    : variant && info.variantBane
      ? info.variantBane
      : info.bane || info.noBane

  return (
    <div className="bo-columns" style={{ marginBottom: '22px' }}>
      <div className="bo-panel bo-curse">
        <div className="bo-row" style={{ marginBottom: '10px' }}>
          <div className="bo-label" style={{ margin: 0 }}>
            Clan bane {clan ? <span className="bo-curse-clan">· {clan}</span> : null}
          </div>
          {info?.variantBane && editable ? (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className={variant ? 'bo-pill' : 'bo-pill is-on'}
                onClick={() => toggleVariant(false)}
              >
                Standard
              </button>
              <button
                type="button"
                className={variant ? 'bo-pill is-on' : 'bo-pill'}
                onClick={() => toggleVariant(true)}
              >
                Variant
              </button>
            </div>
          ) : null}
        </div>
        <p className="bo-prose">
          {baneText || <span className="bo-value is-empty">No clan selected.</span>}
        </p>
      </div>

      <div className="bo-panel bo-curse is-compulsion">
        <div className="bo-label" style={{ marginBottom: '10px' }}>
          Clan compulsion {clan ? <span className="bo-curse-clan">· {clan}</span> : null}
        </div>
        <p className="bo-prose">
          {info?.compulsion || info?.noCompulsion || (
            <span className="bo-value is-empty">No clan selected.</span>
          )}
        </p>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- blood potency */

function PotencyBlock({ actor, editable, locked }) {
  const potency = Number(actor.system.blood?.potency) || 0
  const row = bloodPotencyRow(potency)
  const generation = actor.system.blood?.generation ?? actor.system.headers?.generation
  const range = bloodPotencyRange(generation)

  // Explanations move with the value, as in the standalone app: the tooltip
  // quotes the character's own numbers rather than describing the rule abstractly.
  const cards = [
    [
      'Blood surge',
      `+${row.surge}`,
      `Spend one Rouse Check to add ${row.surge} dice to a single roll, once per scene. Choose it before rolling — the Rouse Check resolves the same turn and may raise Hunger.`
    ],
    [
      'Mend (Rouse)',
      `${row.mend} Sup`,
      `One Rouse Check restores ${row.mend} Superficial damage. Aggravated is untouched by this — it heals one per day's sleep, and costs three Rouse Checks on waking.`
    ],
    [
      'Power bonus',
      row.powerBonus ? `+${row.powerBonus}` : '—',
      row.powerBonus
        ? `Add ${row.powerBonus} dice to any roll using or resisting a Discipline. Automatic — no Rouse Check.`
        : 'No automatic Discipline dice at this Blood Potency. The bonus starts at Blood Potency 2.'
    ],
    [
      'Rouse re-roll',
      row.rouseReroll ? `Lv 1–${row.rouseReroll}` : '—',
      row.rouseReroll
        ? `Activating a Discipline power of level 1–${row.rouseReroll}, a failed Rouse Check may be re-rolled once — potent blood does not always stir Hunger.`
        : 'At this Blood Potency a failed Rouse Check cannot be re-rolled; every failure raises Hunger.'
    ],
    [
      'Bane severity',
      String(row.bane),
      row.bane
        ? `How hard the clan Bane bites. It feeds the clan's own drawback — Brujah subtract ${row.bane} dice resisting fury frenzy, Ventrue lose ${row.bane} feeding on the wrong vessel. It also drives sunlight damage per turn.`
        : 'Thin-bloods usually have no clan Bane. Where background grants one, it counts as severity 1.'
    ]
  ]

  return (
    <div style={{ marginBottom: '22px' }}>
      <div className="bo-row" style={{ marginBottom: '8px' }}>
        <div className="bo-label" style={{ margin: 0 }}>
          Blood potency
        </div>
        {range ? (
          <span style={{ color: 'var(--bo-text-muted)', fontStyle: 'italic', fontSize: '14px' }}>
            {generation}: {range[0]}–{range[1]} · current {potency}
          </span>
        ) : null}
      </div>

      <LinearPips
        label=""
        value={potency}
        max={10}
        fillStart="var(--bo-edge)"
        fillEnd="var(--bo-rule)"
        disabled={!editable}
        locked={locked}
        onChange={(next) => actor.update({ 'system.blood.potency': next })}
      />

      <div className="bo-potency-cards">
        {cards.map(([label, value, info]) => (
          <div key={label} className="bo-potency-card">
            <div className="bo-potency-info">
              <InfoIcon text={info} />
            </div>
            <div className="bo-label">{label}</div>
            <div className="bo-potency-value">{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- humanity */

function HumanityBlock({ actor, editable }) {
  const value = actor.system.humanity?.value ?? 0
  const flaw = humanityFlaw(value)

  return (
    <div style={{ marginBottom: '22px' }}>
      <HumanityTracker
        humanity={value}
        stains={actor.system.humanity?.stains ?? 0}
        disabled={!editable}
        onRemorse={splatOf(actor).remorse ? () => remorseCheck(actor) : null}
        onUpdate={(next) =>
          actor.update(
            Object.fromEntries(
              Object.entries(next).map(([key, entry]) => [
                key === 'humanity' ? 'system.humanity.value' : 'system.humanity.stains',
                entry
              ])
            )
          )
        }
      />
      {flaw ? (
        <div className="bo-panel bo-humanity-note">
          <div className="bo-label" style={{ marginBottom: '6px' }}>
            Humanity {value}
          </div>
          <p className="bo-prose">{flaw}</p>
        </div>
      ) : null}
    </div>
  )
}

/* --------------------------------------------------------------- resonance */

function ResonanceBlock({ actor, editable }) {
  const { humours, temperaments } = resonanceOptions()
  const humour = readSingletonName(actor, 'resonance')
  const temperament = readTemperament(actor)

  return (
    <div style={{ marginBottom: '22px' }}>
      <div className="bo-label" style={{ marginBottom: '8px' }}>
        Blood resonance
        <InfoIcon text="The dominant emotion of the blood last fed on. Choleric feeds Celerity and Potence; Melancholy, Fortitude and Obfuscate; Phlegmatic, Auspex and Dominate; Sanguine, Blood Sorcery and Presence; Animal, Animalism and Protean; Empty, Oblivion. At Intense the matching Disciplines gain a die, and an Acute resonance adds a Dyscrasia on top. Effects last until the next feeding or until Hunger reaches 5." />
      </div>

      <div style={{ display: 'flex', gap: '14px' }}>
        <label className="bo-field-label" style={{ flex: 1 }}>
          <span>Humour</span>
          <Select
            value={humour}
            disabled={!editable}
            options={[{ value: '', label: '—' }, ...humours.map((entry) => ({ value: entry, label: entry }))]}
            onChange={(value) => setResonance(actor, value, temperament)}
          />
        </label>

        <label className="bo-field-label" style={{ flex: 1 }}>
          <span>Temperament</span>
          <Select
            value={temperament}
            disabled={!editable || !humour}
            options={[{ value: '', label: '—' }, ...temperaments.map((entry) => ({ value: entry, label: entry }))]}
            onChange={(value) => setResonance(actor, humour, value)}
          />
        </label>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- predator */

function PredatorGrants({ actor, editable, name }) {
  const [granting, setGranting] = useState(null)
  const journal = readJournal(actor)
  const predator = findPredator(name)
  const applied = journal && journal.predator.toLowerCase() === name.trim().toLowerCase()

  const revert = async () => {
    if (!(await confirmRevert(actor))) return
    await revertGrants(actor)
  }

  if (!applied && !predator) return null

  return (
    <div className="bo-block">
      <div className="bo-label">Granted at creation</div>
      {applied ? (
        <div className="bo-value">
          {journal.entries.map((entry) => entry.label).join(' · ') || 'Nothing new — the character had it all.'}
        </div>
      ) : (
        <div className="bo-value is-empty">Not applied to this character.</div>
      )}

      {editable ? (
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          {applied ? (
            <GhostButton tone="danger" onClick={revert}>
              Take back grants
            </GhostButton>
          ) : (
            <GhostButton tone="accent" onClick={() => setGranting(predator)}>
              Apply grants
            </GhostButton>
          )}
        </div>
      ) : null}

      {granting ? (
        <PredatorGrantsDialog actor={actor} predator={granting} onClose={() => setGranting(null)} />
      ) : null}
    </div>
  )
}

function PredatorBlock({ actor, editable }) {
  const [open, setOpen] = useState(false)
  const name = readSingletonName(actor, 'predatorType')
  const info = predatorInfo(name)
  const table = findPredator(name)

  return (
    <div>
      <SectionTitle sub="What your hunting style grants at creation. Chosen on the Biography tab.">
        Predator type
      </SectionTitle>

      {info ? (
        <div className="bo-panel">
          <h3 className="bo-predator-name">{info.name}</h3>
          <p className="bo-prose">{info.description || info.summary}</p>

          {info.huntingPool ? (
            <div className="bo-block">
              <div className="bo-label">Hunting pool</div>
              <div className="bo-value">{info.huntingPool}</div>
            </div>
          ) : null}

          <PredatorGrants actor={actor} editable={editable} name={name} />

          <GhostButton onClick={() => setOpen((value) => !value)} style={{ marginTop: '14px' }}>
            {open ? 'Hide details' : 'Show details'}
          </GhostButton>

          {open ? (
            <>
              <div className="bo-scalars">
                <LabelledValue label="Specialty" value={info.specialty} />
                <LabelledValue label="Discipline (+1)" value={info.discipline} />
                <LabelledValue label="Humanity" value={info.humanity} />
                <LabelledValue label="Backgrounds" value={info.backgrounds} />
              </div>

              <div className="bo-block">
                <div className="bo-label">Merits &amp; flaws</div>
                <div className="bo-value">
                  {[...(info.merits ?? []), ...(info.flaws ?? [])].join(', ') || '—'}
                </div>
              </div>

              {info.restrictions ? (
                <div className="bo-block">
                  <div className="bo-label">Restrictions</div>
                  <div className="bo-value">{info.restrictions}</div>
                </div>
              ) : null}

              {info.source ? (
                <div className="bo-block">
                  <div className="bo-label">Source</div>
                  <div className="bo-value" style={{ fontStyle: 'italic', color: 'var(--bo-text-dim)' }}>
                    {info.source}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : name ? (
        // No rules reference: the grant table still knows the predator.
        <div className="bo-panel">
          <h3 className="bo-predator-name">{name}</h3>
          {table ? (
            <p className="bo-detail-sub">{table.source}</p>
          ) : null}
          <PredatorGrants actor={actor} editable={editable} name={name} />
        </div>
      ) : (
        <p className="bo-empty" style={{ textAlign: 'left' }}>
          No predator type chosen yet.
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------- tab */

export default function BloodTab({ actor, editable, locked }) {
  const splat = splatOf(actor)

  return (
    <div>
      <SectionTitle
        info={
          splat.potency
            ? 'Blood Potency drives surge, mending, Discipline dice, Rouse re-rolls and Bane Severity. It is bounded by generation, and rises with age and diablerie.'
            : "Humanity is the tether to the person they used to be. It erodes through Stains, and a ghoul's own blood is borrowed, so none of the vampire's Blood mechanics apply."
        }
      >
        {splat.potency ? 'Blood & humanity' : 'Humanity'}
      </SectionTitle>

      {splat.clanBane ? <ClanBlock actor={actor} editable={editable} /> : null}
      {splat.potency ? <PotencyBlock actor={actor} editable={editable} locked={locked} /> : null}
      <HumanityBlock actor={actor} editable={editable} />
      {splat.resonance ? <ResonanceBlock actor={actor} editable={editable} /> : null}
      {splat.potency ? <PredatorBlock actor={actor} editable={editable} /> : null}
    </div>
  )
}
