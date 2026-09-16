import { useState, useSyncExternalStore } from 'react'
import { isLocked, setLocked } from './lock.js'
import { splatOf, splatClass } from './splats.js'
import StatisticsTab from './tabs/StatisticsTab.jsx'
import LimitedView from './tabs/LimitedView.jsx'
import GroupApp from './tabs/GroupApp.jsx'
import BiographyTab from './tabs/BiographyTab.jsx'
import BloodTab from './tabs/BloodTab.jsx'
import DisciplinesTab from './tabs/DisciplinesTab.jsx'
import MeritsFlawsTab from './tabs/MeritsFlawsTab.jsx'
import InventoryTab from './tabs/InventoryTab.jsx'
import NotesTab from './tabs/NotesTab.jsx'
import RollPanel from './roll/RollPanel.jsx'
import { rouseCheck, resistFrenzy, willpowerPool } from './roll/checks.js'
import EditableText from './components/EditableText.jsx'

/** Statistics rows hand over a trait entry; the pool constructor wants a slot. */
function toSlot(entry) {
  if (!entry) return null
  return {
    kind: entry.path.includes('.skills.') ? 'skill' : 'attribute',
    id: entry.id,
    label: entry.label
  }
}

const ALL_TABS = [
  { id: 'bio', label: 'Biography' },
  { id: 'stats', label: 'Statistics' },
  { id: 'blood', label: 'Blood' },
  { id: 'disciplines', label: 'Disciplines' },
  { id: 'merits', label: 'Merits & flaws' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'notes', label: 'Notes & XP' }
]

/**
 * Compact stand-in for the standalone app's masthead: a sheet window cannot
 * spare the vertical space for a centred title block, so the clan and
 * generation line sits under the name instead.
 */
function Padlock({ locked, onToggle }) {
  return (
    <button
      type="button"
      className={locked ? 'bo-padlock is-locked' : 'bo-padlock'}
      onClick={onToggle}
      aria-pressed={locked}
      title={locked ? 'Ratings are locked — click to unlock' : 'Ratings are editable — click to lock'}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4.5" y="10.5" width="15" height="10" rx="1.6" />
        {locked ? (
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        ) : (
          <path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" />
        )}
        <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    </button>
  )
}

function Header({ actor, editable, locked, onToggleLock, onQuickRoll, onResistFrenzy, splat }) {
  const headers = actor.system?.headers ?? {}
  const clan = actor.items.find((item) => item.type === 'clan')?.name
  const generation = actor.system?.blood?.generation ?? headers.generation

  return (
    <header className="bo-header">
      {actor.img ? <img src={actor.img} alt="" className="bo-portrait" /> : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <EditableText
          className="bo-name"
          value={actor.name}
          editable={editable}
          locked={locked}
          placeholder="Unnamed"
          onCommit={(next) => actor.update({ name: next })}
        />
        <p className="bo-subtitle">
          <EditableText
            as="span"
            value={headers.concept ?? ''}
            editable={editable}
            placeholder="No concept recorded"
            onCommit={(next) => actor.update({ 'system.headers.concept': next })}
          />
          {clan ? ` · ${clan}` : ''}
          {generation ? ` · ${generation}th` : ''}
        </p>
      </div>
      <div className="bo-header-actions">
        {splat.resistFrenzy ? (
          <button type="button" className="bo-header-button is-danger" onClick={onResistFrenzy}>
            Resist frenzy
          </button>
        ) : null}
        <button type="button" className="bo-header-button" onClick={onQuickRoll}>
          Quick roll
        </button>
        {editable ? <Padlock locked={locked} onToggle={onToggleLock} /> : null}
      </div>
    </header>
  )
}

export default function App({ store }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [tab, setTab] = useState('stats')
  const [rollSlots, setRollSlots] = useState(null)
  const [locked, setLockedState] = useState(() => isLocked())

  const toggleLock = async () => {
    const next = !locked
    setLockedState(next)
    await setLocked(next)
  }

  if (!snapshot) return null

  const { actor, editable, isOwner } = snapshot

  // Anyone who does not own the character gets the short view — including
  // OBSERVER, which is not "limited" but must not read private data either.
  // The full sheet never renders, so nothing private sits hidden in the DOM.
  if (!isOwner) return <LimitedView actor={actor} />

  // A group is a different kind of sheet entirely — shared ratings and a roster
  // rather than a character — so it gets its own component.
  if (actor.type === 'group') {
    return (
      <GroupApp actor={actor} editable={editable} locked={locked} onToggleLock={toggleLock} />
    )
  }

  // Computed after the snapshot is unpacked — `actor` does not exist before it.
  const splat = splatOf(actor)
  const tabs = ALL_TABS.filter((entry) => splat.tabs.includes(entry.id))
  // Switching an actor's type, or opening a mortal on a remembered tab, must
  // not leave the sheet pointing at a tab this splat does not have.
  const activeTab = tabs.some((entry) => entry.id === tab) ? tab : tabs[0]?.id

  return (
    <div className={`bo-app ${splatClass(actor)}`}>
      <Header
        actor={actor}
        editable={editable}
        locked={locked}
        onToggleLock={toggleLock}
        splat={splat}
        onQuickRoll={() => setRollSlots([null, null, null])}
        onResistFrenzy={() => resistFrenzy(actor)}
      />

      <nav className="bo-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={t.id === activeTab ? 'bo-tab bo-tab-active' : 'bo-tab'}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1 }}>
        {activeTab === 'stats' ? (
          <StatisticsTab
            actor={actor}
            editable={editable}
            locked={locked}
            onRoll={(entry) => setRollSlots([toSlot(entry), null, null])}
            onRouse={() => rouseCheck(actor)}
            onRollWillpower={() =>
              WOD5E.api.Roll({
                basicDice: Math.max(willpowerPool(actor), 1),
                disableAdvancedDice: true,
                actor,
                data: actor.system,
                title: game.i18n.localize('WOD5E.Chat.RollingWillpower'),
                selectors: ['willpower'],
                quickRoll: true
              })
            }
          />
        ) : null}
        {activeTab === 'bio' ? <BiographyTab actor={actor} editable={editable} /> : null}
        {activeTab === 'blood' ? <BloodTab actor={actor} editable={editable} locked={locked} /> : null}
        {activeTab === 'disciplines' ? <DisciplinesTab actor={actor} editable={editable} locked={locked} /> : null}
        {activeTab === 'merits' ? <MeritsFlawsTab actor={actor} editable={editable} locked={locked} /> : null}
        {activeTab === 'inventory' ? <InventoryTab actor={actor} editable={editable} /> : null}
        {activeTab === 'notes' ? <NotesTab actor={actor} editable={editable} /> : null}
      </div>

      {rollSlots ? (
        <RollPanel
          actor={actor}
          editable={editable}
          initialSlots={rollSlots}
          onClose={() => setRollSlots(null)}
        />
      ) : null}
    </div>
  )
}
