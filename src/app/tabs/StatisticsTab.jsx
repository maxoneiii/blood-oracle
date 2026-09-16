import DotTracker from '../components/DotTracker.jsx'
import SkillRow from '../components/SkillRow.jsx'
import { SectionTitle, GhostButton } from '../components/primitives.jsx'
import { DamageTracker, HumanityTracker, HungerTracker } from '../components/Trackers.jsx'
import { getAttributeGroups, getSkillGroups, readTrait } from '../traits.js'

function AttributeRow({ actor, entry, editable, locked, onRoll }) {
  return (
    <div className="bo-stat-row">
      <div className="bo-stat-name">
        <button type="button" className="bo-trait-name" onClick={() => onRoll(entry)}>
          {entry.label}
        </button>
      </div>
      <DotTracker
        value={readTrait(actor, entry.path)}
        disabled={!editable}
        locked={locked}
        onChange={(next) => actor.update({ [entry.path]: next })}
      />
    </div>
  )
}

function Column({ title, children }) {
  return (
    <section>
      <div className="bo-label" style={{ textAlign: 'center', marginBottom: '8px' }}>
        {title}
      </div>
      {children}
    </section>
  )
}

function Trackers({ actor, editable, onRouse, onRollWillpower }) {
  const health = actor.system?.health ?? {}
  const willpower = actor.system?.willpower ?? {}
  const isVampire = actor.system?.gamesystem === 'vampire' && actor.type !== 'ghoul'

  return (
    <div className="bo-columns">
      <DamageTracker
        label="Health"
        max={health.max ?? 0}
        superficial={health.superficial ?? 0}
        aggravated={health.aggravated ?? 0}
        disabled={!editable}
        onUpdate={(next) =>
          actor.update({
            'system.health.superficial': next.superficial,
            'system.health.aggravated': next.aggravated
          })
        }
      />

      <DamageTracker
        label="Willpower"
        onRoll={onRollWillpower}
        max={willpower.max ?? 0}
        superficial={willpower.superficial ?? 0}
        aggravated={willpower.aggravated ?? 0}
        disabled={!editable}
        onUpdate={(next) =>
          actor.update({
            'system.willpower.superficial': next.superficial,
            'system.willpower.aggravated': next.aggravated
          })
        }
      />

      {isVampire ? (
        <div>
          <HungerTracker
            value={actor.system?.hunger?.value ?? 0}
            disabled={!editable}
            onChange={(next) => actor.update({ 'system.hunger.value': next })}
            inlineExtra={
              editable ? (
                <GhostButton tone="danger" onClick={onRouse} style={{ padding: '4px 10px' }}>
                  Rouse
                </GhostButton>
              ) : null
            }
          />
        </div>
      ) : null}

      <HumanityTracker
        humanity={actor.system?.humanity?.value ?? 0}
        stains={actor.system?.humanity?.stains ?? 0}
        disabled={!editable}
        onUpdate={(next) =>
          actor.update(
            Object.fromEntries(
              Object.entries(next).map(([key, value]) => [
                key === 'humanity' ? 'system.humanity.value' : 'system.humanity.stains',
                value
              ])
            )
          )
        }
      />
    </div>
  )
}

export default function StatisticsTab({
  actor,
  editable,
  onRoll,
  onRouse,
  onRollWillpower,
  locked
}) {
  return (
    <div>
      <SectionTitle info="Click a damage box to add Superficial, again to convert it to Aggravated; right-click reverses. Health is Stamina + 3, Willpower is Composure + Resolve. A full track means Impaired: two dice off pools using that category. Right-click an empty Humanity box to mark a Stain.">
        Trackers
      </SectionTitle>
      <div style={{ marginBottom: '26px' }}>
        <Trackers
          actor={actor}
          editable={editable}
          onRouse={onRouse}
          onRollWillpower={onRollWillpower}
        />
      </div>

      <SectionTitle info="Click a trait to start a dice pool. Attributes describe what the character is; most pools pair one Attribute with one Skill.">
        Attributes
      </SectionTitle>
      <div className="bo-columns" style={{ marginBottom: '26px' }}>
        {getAttributeGroups().map((group) => (
          <Column key={group.type} title={group.label}>
            {group.entries.map((entry) => (
              <AttributeRow
                key={entry.id}
                actor={actor}
                entry={entry}
                editable={editable}
                locked={locked}
                onRoll={onRoll}
              />
            ))}
          </Column>
        ))}
      </div>

      <SectionTitle info="A Specialty adds one die when it applies. Click beside a skill with dots to name one.">
        Skills
      </SectionTitle>
      <div className="bo-columns">
        {getSkillGroups().map((group) => (
          <Column key={group.type} title={group.label}>
            {group.entries.map((entry) => (
              <SkillRow
                key={entry.id}
                actor={actor}
                entry={entry}
                editable={editable}
                locked={locked}
                onRoll={onRoll}
              />
            ))}
          </Column>
        ))}
      </div>
    </div>
  )
}
