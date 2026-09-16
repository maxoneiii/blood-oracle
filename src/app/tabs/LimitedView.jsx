import RichText from '../components/RichText.jsx'
import { SectionTitle } from '../components/primitives.jsx'
import { getHungerDice } from '../roll/bridge.js'

/**
 * The limited view, shown to players who are not owners of this character.
 *
 * wod5e sets `ownership.default` to LIMITED on every actor, so this is what
 * everyone at the table sees when they open someone else's sheet by default.
 *
 * Deliberately short: portrait, name, appearance, the chronicle's tenets and
 * Hunger. Everything else — traits, disciplines, principles, merits, the blood
 * itself — stays private. Hunger is here because it already shows on the token
 * and reads in play anyway.
 */
export default function LimitedView({ actor }) {
  const hunger = getHungerDice(actor)
  const isVampire = actor.system?.gamesystem === 'vampire' && actor.type !== 'ghoul'

  return (
    <div className="bo-app">
      <header className="bo-header">
        {actor.img ? <img src={actor.img} alt="" className="bo-portrait" /> : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="bo-name">{actor.name}</h1>
        </div>
        {isVampire ? (
          <div style={{ textAlign: 'center', minWidth: '70px' }}>
            <div className="bo-label" style={{ marginBottom: '2px' }}>
              Hunger
            </div>
            <div style={{ font: '600 23px var(--bo-serif)', color: 'var(--bo-red-glow)' }}>
              {hunger}
            </div>
          </div>
        ) : null}
      </header>

      <div style={{ marginTop: '22px' }}>
        <SectionTitle>Appearance</SectionTitle>
        <RichText
          content={actor.system?.appearance}
          placeholder="Nothing recorded about how they look."
        />
      </div>

      <div style={{ marginTop: '26px' }}>
        <SectionTitle>Chronicle tenets</SectionTitle>
        <RichText
          content={actor.system?.headers?.tenets}
          placeholder="No tenets set for this chronicle."
        />
      </div>
    </div>
  )
}
