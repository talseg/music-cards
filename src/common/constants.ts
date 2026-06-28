// Public, browser-readable flag (separate from the proxy-only secret key).
// The "Get AI dates" feature is fail-closed: hidden unless this is exactly
// 'true'. Anything else (absent / other value) leaves the feature off.
export const DATES_ENABLED = import.meta.env.VITE_DATES_ENABLED === 'true'

// Cards laid out per printed sheet (2x2 grid of front/back pairs).
export const CARDS_PER_SHEET = 4

// When adding an imported bunch or deleting a multi-selection, rows are added /
// removed one at a time (top first) this many milliseconds apart, so they appear
// or disappear gradually instead of all at once (which is jarring and loses the
// user's place).
export const STAGGER_MS = 40

export const DISPLAY_LONG_LIST = true;
