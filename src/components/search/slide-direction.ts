const SLIDE_KEY = "mm.search.slide";

/** Stash the slide direction before navigating between search tabs. */
export const setSearchSlideDirection = (direction: "next" | "prev") => {
  try {
    sessionStorage.setItem(SLIDE_KEY, direction);
  } catch {
    return;
  }
};

export const readSlideDirection = (): "next" | "prev" | null => {
  try {
    const value = sessionStorage.getItem(SLIDE_KEY);
    sessionStorage.removeItem(SLIDE_KEY);
    return value === "next" || value === "prev" ? value : null;
  } catch {
    return null;
  }
};
