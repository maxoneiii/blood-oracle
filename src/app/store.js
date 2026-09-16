/**
 * The smallest store that satisfies `useSyncExternalStore`. The sheet pushes a
 * new snapshot on every Foundry render; React re-renders because the snapshot
 * identity changed.
 */
export function createStore(initial) {
  let snapshot = initial
  const listeners = new Set()

  return {
    getSnapshot: () => snapshot,
    set(next) {
      snapshot = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}
