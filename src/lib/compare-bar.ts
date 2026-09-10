import { useSyncExternalStore } from "react";

const visibleKeys = new Set<string>();
let visible = false;
const listeners = new Set<() => void>();

// Multiple compare bars (tutors, cases) can be mounted at once; visibility is
// true while any source requests it.
export function setCompareBarVisible(key: string, next: boolean) {
  if (next) visibleKeys.add(key);
  else visibleKeys.delete(key);
  const nextVisible = visibleKeys.size > 0;
  if (nextVisible === visible) return;
  visible = nextVisible;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCompareBarVisible() {
  return useSyncExternalStore(
    subscribe,
    () => visible,
    () => visible,
  );
}
