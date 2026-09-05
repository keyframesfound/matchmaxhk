import { useSyncExternalStore } from "react";

let visible = false;
const listeners = new Set<() => void>();

export function setCompareBarVisible(next: boolean) {
  if (next === visible) return;
  visible = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCompareBarVisible() {
  return useSyncExternalStore(subscribe, () => visible);
}
