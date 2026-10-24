import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, GhostButton } from '../components/primitives.jsx'
import Select from '../components/Select.jsx'
import { getAttributeGroups, getSkillGroups } from '../traits.js'
import { getAllDisciplines } from '../schema/custom-disciplines.js'
import { composePool } from './pool.js'
import { getHungerDice, splitPool } from './bridge.js'
import { rouseCheck } from './checks.js'
import OddsPopover from './OddsPopover.jsx'
import Stepper from '../components/Stepper.jsx'

const EMPTY = { kind: null, id: null, label: '' }
const SLOT_COUNT = 3

/**
 * The standalone app's pool constructor: three independent trait slots plus a
 * Storyteller modifier, with blood surge, specialty and resonance applied on
 * top. Every contribution is listed so the number can be argued with.
 */
export default function RollPanel({ actor, editable, initialSlots, onClose }) {
  const [slots, setSlots] = useState(() => Array.from({ length: SLOT_COUNT }, () => EMPTY))
  const [modifier, setModifier] = useState(0)
  const [difficulty, setDifficulty] = useState(0)
  const [bloodSurge, setBloodSurge] = useState(false)
  // '' is "no specialty"; otherwise the key of the one applied.
  const [specialtyKey, setSpecialtyKey] = useState('')
  const [oddsOpen, setOddsOpen] = useState(false)
  const oddsRef = useRef(null)
  const closeOdds = useCallback(() => setOddsOpen(false), [])
  const [useResonance, setUseResonance] = useState(false)
  const [useWeaponDamage, setUseWeaponDamage] = useState(false)
  const [rolling, setRolling] = useState(false)

  useEffect(() => {
    if (!initialSlots) return
    setSlots(
      Array.from({ length: SLOT_COUNT }, (_, index) => initialSlots[index] ?? EMPTY)
    )
  }, [initialSlots])

  const options = useMemo(() => {
    const attributes = getAttributeGroups().flatMap((group) =>
      group.entries.map((entry) => ({
        key: `attribute:${entry.id}`,
        kind: 'attribute',
        id: entry.id,
        label: entry.label,
        group: `Attributes · ${group.label}`
      }))
    )
    const skills = getSkillGroups().flatMap((group) =>
      group.entries.map((entry) => ({
        key: `skill:${entry.id}`,
        kind: 'skill',
        id: entry.id,
        label: entry.label,
        group: `Skills · ${group.label}`
      }))
    )
    // Only disciplines the character actually has are offered.
    const disciplines = getAllDisciplines()
      .filter((entry) => Number(actor.system.disciplines?.[entry.id]?.value) > 0)
      .map((entry) => ({
        key: `discipline:${entry.id}`,
        kind: 'discipline',
        id: entry.id,
        label: entry.label,
        group: 'Disciplines'
      }))

    return [...attributes, ...skills, ...disciplines]
  }, [actor])

  // What the dropdown shows. A skill with no dots can still be rolled — the
  // Attribute alone — so it is not removed, only moved to the end and muted.
  const dotsOf = (option) => {
    const path =
      option.kind === 'attribute'
        ? `system.attributes.${option.id}.value`
        : option.kind === 'skill'
          ? `system.skills.${option.id}.value`
          : `system.disciplines.${option.id}.value`
    return Number(foundry.utils.getProperty(actor, path)) || 0
  }

  const menuOptions = (() => {
    const trained = []
    const untrained = []
    for (const option of options) {
      const dots = dotsOf(option)
      const entry = {
        value: option.key,
        label: option.label,
        group: option.group,
        hint: dots ? '●'.repeat(Math.min(dots, 10)) : '—'
      }
      if (option.kind === 'skill' && !dots) {
        untrained.push({ ...entry, group: 'Untrained skills', muted: true })
      } else {
        trained.push(entry)
      }
    }
    return [...trained, ...untrained]
  })()

  const composition = composePool(actor, {
    slots,
    modifier,
    options: { bloodSurge, specialty: specialtyKey, useResonance, useWeaponDamage }
  })

  // Toggles switch themselves off when their precondition disappears, so the
  // displayed pool never includes a bonus that no longer applies.
  useEffect(() => {
    if (specialtyKey && !composition.chosenSpecialty) setSpecialtyKey('')
    if (!composition.resonanceAvailable && useResonance) setUseResonance(false)
    if (!composition.weaponBonusAvailable && useWeaponDamage) setUseWeaponDamage(false)
  }, [
    composition.chosenSpecialty,
    composition.resonanceAvailable,
    composition.weaponBonusAvailable,
    specialtyKey,
    useResonance,
    useWeaponDamage
  ])

  // A different skill means a different list: start again from "None".
  const skillSignature = slots
    .filter((slot) => slot?.kind === 'skill' && slot.id)
    .map((slot) => slot.id)
    .join('|')
  useEffect(() => {
    setSpecialtyKey('')
  }, [skillSignature])

  const hunger = getHungerDice(actor)
  const { basicDice, advancedDice } = splitPool(composition.total, hunger)

  const setSlot = (index, key) => {
    const found = options.find((option) => option.key === key)
    setSlots((prev) => prev.map((slot, i) => (i === index ? found ?? EMPTY : slot)))
  }

  const doRoll = async () => {
    setRolling(true)
    try {
      // Blood surge is paid for with a Rouse check, made before the roll so the
      // hunger it may cause is visible in the chat log in the right order.
      if (bloodSurge) {
        await rouseCheck(actor, { title: 'Blood Surge' })
      }

      await WOD5E.api.Roll({
        basicDice,
        advancedDice,
        actor,
        data: actor.system,
        title: composition.label || 'Rolling',
        flavor: (composition.weaponBonus ? `Weapon +${composition.weaponBonus} · ` : '') +
          composition.parts
          .map((part) => `${part.label} ${part.value >= 0 ? '+' : '−'}${Math.abs(part.value)}`)
          .join(' '),
        difficulty: Number(difficulty) || 0,
        quickRoll: true,
        selectors: slots.filter((slot) => slot?.id).map((slot) => slot.id)
      })
      onClose?.()
    } catch (error) {
      console.error('Blood Oracle | Roll failed', error)
      ui.notifications.error('The roll could not be completed. See the console for details.')
    } finally {
      setRolling(false)
    }
  }

  const chosenKey = composition.chosenSpecialty?.key ?? ''
  const manySkills = composition.specialtyChoices.length > 1

  return (
    <Modal title="Build a pool" onClose={onClose}>
      <div style={{ display: 'grid', gap: '11px' }}>
        {slots.map((slot, index) => (
          <label key={index} className="bo-field-label">
            <span>Trait {index + 1}</span>
            <Select
              value={slot.kind ? `${slot.kind}:${slot.id}` : ''}
              disabled={!editable}
              searchable
              options={[{ value: '', label: '—' }, ...menuOptions]}
              onChange={(key) => setSlot(index, key)}
            />
          </label>
        ))}
      </div>

      <div className="bo-block">
        <label className={bloodSurge ? 'bo-toggle is-surge is-on' : 'bo-toggle is-surge'}>
          <input
            type="checkbox"
            checked={bloodSurge}
            onChange={(event) => setBloodSurge(event.target.checked)}
          />
          <span>Blood surge</span>
          <span className="bo-toggle-note">
            {bloodSurge
              ? `+${composition.surge} dice · costs a Rouse check`
              : `+${composition.surge} at Blood Potency ${composition.potency}`}
          </span>
        </label>

        {/* One specialty per roll, picked from chips: all of them in sight, so a
            player sees there are several, without a list breaking the block. */}
        <div className={composition.specialtyAvailable ? 'bo-toggle bo-spec-row' : 'bo-toggle bo-spec-row is-disabled'}>
          <span className="bo-toggle-spacer" aria-hidden="true" />
          <span>Specialty</span>
          {composition.specialtyAvailable ? (
            <div className="bo-spec-chips" role="radiogroup" aria-label="Specialty">
              <button
                type="button"
                role="radio"
                aria-checked={!chosenKey}
                className={chosenKey ? 'bo-chip is-none' : 'bo-chip is-none is-selected'}
                onClick={() => setSpecialtyKey('')}
              >
                None
              </button>
              {composition.specialtyChoices.map((group) => [
                manySkills ? (
                  <span key={`${group.skillId}-label`} className="bo-chip-group">
                    {group.skillLabel}
                  </span>
                ) : null,
                ...group.entries.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    role="radio"
                    aria-checked={chosenKey === entry.key}
                    className={chosenKey === entry.key ? 'bo-chip is-selected' : 'bo-chip'}
                    title={entry.granted ? 'Granted by the predator type' : undefined}
                    onClick={() => setSpecialtyKey(entry.key)}
                  >
                    {entry.text}
                    {entry.granted ? <span className="bo-chip-origin">pred</span> : null}
                  </button>
                ))
              ])}
              {chosenKey ? <span className="bo-toggle-note">+1 die</span> : null}
            </div>
          ) : (
            <span className="bo-toggle-note">no specialty on the chosen skills</span>
          )}
        </div>

        <label
          className={composition.weaponBonusAvailable ? 'bo-toggle' : 'bo-toggle is-disabled'}
        >
          <input
            type="checkbox"
            checked={useWeaponDamage}
            disabled={!composition.weaponBonusAvailable}
            onChange={(event) => setUseWeaponDamage(event.target.checked)}
          />
          <span>Weapon damage</span>
          <span className="bo-toggle-note">
            {composition.weaponBonusAvailable
              ? `+${composition.weaponBonusAvailable} to successes, not dice`
              : composition.weaponType
                ? 'no equipped weapon of that kind'
                : 'only for Melee and Firearms'}
          </span>
        </label>

        <label className={composition.resonanceAvailable ? 'bo-toggle' : 'bo-toggle is-disabled'}>
          <input
            type="checkbox"
            checked={useResonance}
            disabled={!composition.resonanceAvailable}
            onChange={(event) => setUseResonance(event.target.checked)}
          />
          <span>Resonance</span>
          <span className="bo-toggle-note">
            {composition.resonanceAvailable
              ? `+1 · ${composition.resonance.humour} ${composition.resonance.temperament}`
              : 'no resonance matching the chosen discipline'}
          </span>
        </label>
      </div>

      <div className="bo-block">
        <div className="bo-label">Pool</div>
        <ul className="bo-breakdown">
          {composition.parts.map((part, index) => (
            <li key={`${part.label}-${index}`}>
              <span>{part.label}</span>
              <span className={part.value < 0 ? 'is-penalty' : undefined}>
                {part.value >= 0 ? '+' : '−'}
                {Math.abs(part.value)}
              </span>
            </li>
          ))}
          {!composition.parts.length ? (
            <li>
              <span className="bo-roll-note is-faint">Nothing selected yet.</span>
            </li>
          ) : null}
        </ul>

        <div className="bo-roll-summary">
          <p className="bo-prose">
            Rolling <strong>{basicDice}</strong> normal and{' '}
            <strong style={{ color: 'var(--bo-red-glow)' }}>{advancedDice}</strong> hunger.
          </p>
          <button
            ref={oddsRef}
            type="button"
            className={oddsOpen ? 'bo-ghost is-accent is-open' : 'bo-ghost'}
            disabled={!composition.canRoll}
            onClick={() => setOddsOpen((open) => !open)}
            title="Chances for this pool"
          >
            Odds
          </button>
        </div>
        {composition.weaponBonus ? (
          <p className="bo-roll-note">
            Plus {composition.weaponBonus} damage on a win — added to successes, not rolled.
          </p>
        ) : null}
        {composition.unequippedWarning ? (
          <p className="bo-roll-note is-accent">A weapon of that kind is carried but not equipped.</p>
        ) : null}
        {composition.flooredToOne ? (
          <p className="bo-roll-note is-red">
            Penalties would take this below one die; the pool is held at one.
          </p>
        ) : null}
      </div>

      {/* The numbers the Storyteller calls out sit by the button they feed. */}
      <div className="bo-roll-footer">
        <Stepper label="Modifier" value={modifier} min={-10} max={10} onChange={setModifier} />
        <Stepper label="Difficulty" value={difficulty} min={0} max={15} onChange={setDifficulty} />
        <div className="bo-roll-actions">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <button
            type="button"
            className="bo-solid"
            onClick={doRoll}
            disabled={rolling || !composition.canRoll}
          >
            {rolling ? 'Rolling…' : 'Roll'}
          </button>
        </div>
      </div>

      {oddsOpen && composition.canRoll ? (
        <OddsPopover
          anchor={oddsRef.current}
          basicDice={basicDice}
          hungerDice={advancedDice}
          difficulty={difficulty}
          onClose={closeOdds}
        />
      ) : null}
    </Modal>
  )
}
