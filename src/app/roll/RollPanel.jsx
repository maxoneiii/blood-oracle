import { useEffect, useMemo, useState } from 'react'
import { Modal, GhostButton } from '../components/primitives.jsx'
import { getAttributeGroups, getSkillGroups } from '../traits.js'
import { getAllDisciplines } from '../schema/custom-disciplines.js'
import { composePool } from './pool.js'
import { getHungerDice, splitPool } from './bridge.js'
import { rouseCheck } from './checks.js'

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
  const [useSpecialty, setUseSpecialty] = useState(false)
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

  const composition = composePool(actor, {
    slots,
    modifier,
    options: { bloodSurge, useSpecialty, useResonance, useWeaponDamage }
  })

  // Toggles switch themselves off when their precondition disappears, so the
  // displayed pool never includes a bonus that no longer applies.
  useEffect(() => {
    if (!composition.specialtyAvailable && useSpecialty) setUseSpecialty(false)
    if (!composition.resonanceAvailable && useResonance) setUseResonance(false)
    if (!composition.weaponBonusAvailable && useWeaponDamage) setUseWeaponDamage(false)
  }, [
    composition.specialtyAvailable,
    composition.resonanceAvailable,
    composition.weaponBonusAvailable,
    useSpecialty,
    useResonance,
    useWeaponDamage
  ])

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

  return (
    <Modal title="Build a pool" onClose={onClose}>
      <div style={{ display: 'grid', gap: '11px' }}>
        {slots.map((slot, index) => (
          <label key={index} className="bo-field-label">
            <span>Trait {index + 1}</span>
            <select
              className="bo-field"
              value={slot.kind ? `${slot.kind}:${slot.id}` : ''}
              disabled={!editable}
              onChange={(event) => setSlot(index, event.target.value)}
            >
              <option value="">—</option>
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.group} — {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        <div style={{ display: 'flex', gap: '12px' }}>
          <label className="bo-field-label" style={{ flex: 1 }}>
            <span>Modifier</span>
            <input
              type="number"
              className="bo-field"
              value={modifier}
              min={-5}
              max={5}
              onChange={(event) => setModifier(parseInt(event.target.value, 10) || 0)}
            />
          </label>
          <label className="bo-field-label" style={{ flex: 1 }}>
            <span>Difficulty</span>
            <input
              type="number"
              className="bo-field"
              value={difficulty}
              min={0}
              onChange={(event) => setDifficulty(parseInt(event.target.value, 10) || 0)}
            />
          </label>
        </div>
      </div>

      <div className="bo-block">
        <label className="bo-toggle">
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

        <label className={composition.specialtyAvailable ? 'bo-toggle' : 'bo-toggle is-disabled'}>
          <input
            type="checkbox"
            checked={useSpecialty}
            disabled={!composition.specialtyAvailable}
            onChange={(event) => setUseSpecialty(event.target.checked)}
          />
          <span>Specialty</span>
          <span className="bo-toggle-note">
            {composition.specialtyAvailable
              ? `+1 · ${composition.specialtyText}`
              : 'no specialty on the chosen skill'}
          </span>
        </label>

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
              <span style={{ color: 'var(--bo-text-faint)', fontStyle: 'italic' }}>
                Nothing selected yet.
              </span>
            </li>
          ) : null}
        </ul>

        <p className="bo-prose" style={{ marginTop: '10px' }}>
          Rolling <strong>{basicDice}</strong> normal and{' '}
          <strong style={{ color: 'var(--bo-red-glow)' }}>{advancedDice}</strong> hunger.
        </p>
        {composition.weaponBonus ? (
          <p style={{ color: 'var(--bo-text-dim)', fontSize: '14px', margin: '4px 0 0' }}>
            Plus {composition.weaponBonus} damage on a win — added to successes, not rolled.
          </p>
        ) : null}
        {composition.unequippedWarning ? (
          <p style={{ color: 'var(--bo-accent)', fontSize: '14px', margin: '4px 0 0' }}>
            A weapon of that kind is carried but not equipped.
          </p>
        ) : null}
        {composition.flooredToOne ? (
          <p style={{ color: 'var(--bo-accent-red)', fontSize: '14px', margin: '4px 0 0' }}>
            Penalties would take this below one die; the pool is held at one.
          </p>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
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
    </Modal>
  )
}
