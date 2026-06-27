// Public, browser-readable flag (separate from the proxy-only secret key).
// The "Get AI dates" feature is fail-closed: hidden unless this is exactly
// 'true'. Anything else (absent / other value) leaves the feature off.
export const DATES_ENABLED = import.meta.env.VITE_DATES_ENABLED === 'true'

// Cards laid out per printed sheet (2x2 grid of front/back pairs).
export const CARDS_PER_SHEET = 4

// When deleting a multi-selection, rows are removed one at a time (top first)
// this many milliseconds apart, so they disappear gradually instead of all at
// once (which is jarring and loses the user's place).
export const DELETE_STAGGER_MS = 150
