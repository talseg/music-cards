// Public, browser-readable flag (separate from the proxy-only secret key).
// The "Get AI dates" feature is fail-closed: hidden unless this is exactly
// 'true'. Anything else (absent / other value) leaves the feature off.
export const DATES_ENABLED = import.meta.env.VITE_DATES_ENABLED === 'true'
