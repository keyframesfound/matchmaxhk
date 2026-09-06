export function blurActive(): void {
  try {
    const active = document.activeElement as HTMLElement | null;
    if (
      active &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)
    ) {
      active.blur();
    }
  } catch {
    // ignore
  }
}
