import { useState, useEffect } from 'react'
import type { SpotifyApi } from '@spotify/web-api-ts-sdk'
import type { AuthState } from '../common/types'
import { createAuth, type InitAuthResult } from './spotify-auth'

// Create the auth bundle once at module load. The shared module (src/auth) is
// app-agnostic; everything app-specific about auth lives in this config below.
const auth_ = createAuth({
  clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID as string,
  // Only what the playlist-import feature needs — deliberately omits the playback
  // scopes the separate player app uses.
  scopes: ['playlist-read-private', 'playlist-read-collaborative', 'user-library-read'],
  cachePrefix: 'music-cards:',
})

// The configured SDK, used by the playlist-import feature in App.
export const sdk: SpotifyApi = auth_.sdk

// The redirect URI App shows in the logged-out hint.
export function getRedirectUri(): string {
  return auth_.getRedirectUri()
}

// ─── Allowed-port check ───────────────────────────────────────────────────────

// The current port when it isn't in allowed-redirect-uris.txt, plus the exact
// URI line to add there (and to the Spotify dashboard) to allow it.
export interface DisallowedPort {
  port: string
  suggestedUri: string
}

// The allowed ports come from allowed-redirect-uris.txt, injected at build time
// by vite.config.ts. An empty location port means the protocol default (443) on
// a real deployment — always allowed. Computed once: the location can't change
// without a page load.
function checkPort(): DisallowedPort | null {
  const allowed = (import.meta.env.VITE_ALLOWED_PORTS ?? '').split(',')
  const port = window.location.port
  if (port === '' || allowed.includes(port)) return null
  return { port, suggestedUri: `https://127.0.0.1:${port}/callback` }
}

// Exported for RedirectUriHint (a plain value, not hook state — the location
// can't change without a page load).
export const disallowedPort = checkPort()

// Map the shared auth module's neutral result onto this app's AuthState model.
// (Error classification and the memoized exactly-once init live in
// src/auth/spotify-auth.ts.)
function toAuthState(result: InitAuthResult): AuthState {
  if (result.ok) {
    return { kind: 'in', user: result.user }
  }
  switch (result.kind) {
    case 'no-session':
      return { kind: 'out', error: null }
    case 'expired':
      // A stored token that no longer works: silently back to logged-out.
      return { kind: 'out', error: null }
    case 'stale-callback':
      // Transient PKCE verifier-not-found: partial state was cleared by the
      // shared module; user lands on a clean logged-out screen and can retry.
      return { kind: 'out', error: null }
    case 'redirect-uri':
      return {
        kind: 'out',
        error: `Login failed: redirect URI not registered.\nAdd ${result.redirectUri} at https://developer.spotify.com/dashboard`,
      }
    case 'error':
      return { kind: 'out', error: `Login failed: ${result.message}` }
  }
}

// The login feature exposed to the app. The return shape of useAuth.
export interface AuthInterface {
  auth: AuthState
  loggedIn: boolean
  login: () => void
  logout: () => void
  // Non-null when the app runs on a port missing from allowed-redirect-uris.txt;
  // login is blocked (Spotify would dead-end on its "invalid redirect URI" page).
  disallowedPort: DisallowedPort | null
}

// Owns the (non-blocking) Spotify login feature: auth phase, the mount-time
// OAuth-callback / stored-token validation, and login/logout actions.
export function useAuth(): AuthInterface {
  const [auth, setAuth] = useState<AuthState>({ kind: 'checking' })

  // On mount, resolve the initial auth state once: getInitAuth() handles the
  // OAuth callback or silently validates a stored token. It's memoized in the
  // shared module, so the work runs once despite StrictMode's double-mount; the
  // cancel flag ensures only the still-mounted invocation applies the result
  // (leaving the 'checking' state).
  useEffect(() => {
    let cancelled = false
    auth_.getInitAuth().then(result => {
      if (!cancelled) setAuth(toAuthState(result))
    })
    return () => { cancelled = true }
  }, [])

  const login = () => {
    if (disallowedPort) return // button is disabled; never navigate to a dead end
    sdk.authenticate().catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e)
      setAuth({ kind: 'out', error: `Login failed: ${message}` })
    })
  }

  const logout = () => {
    auth_.clearStoredAuth()
    setAuth({ kind: 'out', error: null })
  }

  return { auth, loggedIn: auth.kind === 'in', login, logout, disallowedPort }
}
