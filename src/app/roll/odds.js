/**
 * Exact odds for a V5 roll, by walking every die rather than simulating.
 *
 * Rules, as in the corebook:
 *   - 6–10 is a success on any die; 1–5 is not.
 *   - Every pair of 10s counts as four successes instead of two.
 *   - A critical win is a win with at least one pair of 10s.
 *   - It is messy when a hunger die shows a 10.
 *   - A bestial failure is a roll that does not win with a 1 on a hunger die.
 *   - A total failure is no successes at all.
 *
 * The state after each die is (plain successes, 10s, a hunger 10 seen, a
 * hunger 1 seen). Pools stay small, so the state space does too.
 */

const NORMAL = [
  { p: 0.5, success: 0, ten: 0, hungerTen: false, hungerOne: false }, // 1–5
  { p: 0.4, success: 1, ten: 0, hungerTen: false, hungerOne: false }, // 6–9
  { p: 0.1, success: 0, ten: 1, hungerTen: false, hungerOne: false } // 10
]

const HUNGER = [
  { p: 0.1, success: 0, ten: 0, hungerTen: false, hungerOne: true }, // 1
  { p: 0.4, success: 0, ten: 0, hungerTen: false, hungerOne: false }, // 2–5
  { p: 0.4, success: 1, ten: 0, hungerTen: false, hungerOne: false }, // 6–9
  { p: 0.1, success: 0, ten: 1, hungerTen: true, hungerOne: false } // 10
]

const keyOf = (s, t, h, o) => `${s}|${t}|${h ? 1 : 0}|${o ? 1 : 0}`

function addDie(states, faces) {
  const next = new Map()
  for (const state of states.values()) {
    for (const face of faces) {
      const s = state.s + face.success
      const t = state.t + face.ten
      const h = state.h || face.hungerTen
      const o = state.o || face.hungerOne
      const key = keyOf(s, t, h, o)
      const entry = next.get(key)
      if (entry) entry.p += state.p * face.p
      else next.set(key, { s, t, h, o, p: state.p * face.p })
    }
  }
  return next
}

/**
 * Every distinct outcome of the roll with its probability:
 *   [{ successes, critical, hungerTen, hungerOne, p }]
 */
export function rollOutcomes(basicDice, hungerDice) {
  let states = new Map([[keyOf(0, 0, false, false), { s: 0, t: 0, h: false, o: false, p: 1 }]])
  for (let i = 0; i < basicDice; i++) states = addDie(states, NORMAL)
  for (let i = 0; i < hungerDice; i++) states = addDie(states, HUNGER)

  return [...states.values()].map((state) => ({
    successes: state.s + state.t + 2 * Math.floor(state.t / 2),
    critical: state.t >= 2,
    hungerTen: state.h,
    hungerOne: state.o,
    p: state.p
  }))
}

/**
 * The summary and the per-success table for a pool at a difficulty.
 * Difficulty 0 means none was set: win-dependent figures come back null.
 */
export function rollOdds(basicDice, hungerDice, difficulty = 0) {
  const outcomes = rollOutcomes(basicDice, hungerDice)
  const target = Math.max(0, Number(difficulty) || 0)

  const exactly = []
  for (const outcome of outcomes) {
    exactly[outcome.successes] = (exactly[outcome.successes] ?? 0) + outcome.p
  }
  const max = exactly.length - 1
  for (let k = 0; k <= max; k++) exactly[k] = exactly[k] ?? 0

  const atLeast = []
  let running = 0
  for (let k = max; k >= 0; k--) {
    running += exactly[k]
    atLeast[k] = running
  }

  const sum = (test) => outcomes.reduce((total, outcome) => (test(outcome) ? total + outcome.p : total), 0)
  const wins = (outcome) => target > 0 && outcome.successes >= target

  return {
    difficulty: target,
    table: exactly.map((p, k) => ({ successes: k, exactly: p, atLeast: atLeast[k] })),
    totalFailure: exactly[0] ?? 0,
    // The pair of 10s alone, whether or not the roll then wins.
    anyPair: sum((outcome) => outcome.critical),
    win: target > 0 ? sum(wins) : null,
    criticalWin: target > 0 ? sum((o) => wins(o) && o.critical && !o.hungerTen) : null,
    messyCritical: target > 0 ? sum((o) => wins(o) && o.critical && o.hungerTen) : null,
    bestialFailure: target > 0 ? sum((o) => !wins(o) && o.hungerOne) : null
  }
}
