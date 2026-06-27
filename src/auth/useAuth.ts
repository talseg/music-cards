import { useState, useEffect } from 'react'
import type { SpotifyApi } from '@spotify/web-api-ts-sdk'
import type { AuthState } from '../common/types'
import { createAuth, type InitAuthResult } from './spotify-auth'

// Create the auth bundle once at module load. The shared module (src/auth) is
// app-agnostic; everything app-specific about auth lives in this config.
// Only what the playlist-import feature needs. Deliberately omits the playback
// scopes the separate player app uses.
const auth_ = createAuth({
  clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID as string,
  scopes: ['playlist-read-private', 'playlist-read-collaborative', 'user-library-read'],
  cachePrefix: 'music-cards:',
})

// The configured SDK, used by the playlist-import feature in App.
export const sdk: SpotifyApi = auth_.sdk

// The redirect URI App shows in the logged-out hint.
export function getRedirectUri(): string {
  return auth_.getRedirectUri()
}

// Map the shared auth module's neutral result onto this app's AuthState model.
// (Error classification and the memoized exactly-once init live in
// src/auth/spotify-auth.ts; messages here are preserved from the previous
// in-file implementation.)
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
}

// Owns the (non-blocking) Spotify login feature: auth phase, the mount-time
// OAuth-callback / stored-token validation, and login/logout actions.
export function useAuth(): AuthInterface {
  const [auth, setAuth] = useState<AuthState>({ kind: 'checking' })

  // On mount: handle the OAuth callback, or silently validate a stored token.
  // The actual work is memoized inside the shared auth module (getInitAuth),
  // so it runs exactly once even though StrictMode invokes this effect twice
  // in dev. Both invocations await the same promise; whichever is still
  // mounted applies the result, so the UI always leaves the 'checking' state.
  useEffect(() => {
    let cancelled = false
    auth_.getInitAuth().then(result => {
      if (!cancelled) setAuth(toAuthState(result))
    })
    return () => { cancelled = true }
  }, [])

  const login = () => {
    sdk.authenticate().catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e)
      setAuth({ kind: 'out', error: `Login failed: ${message}` })
    })
  }

  const logout = () => {
    auth_.clearStoredAuth()
    setAuth({ kind: 'out', error: null })
  }

  return { auth, loggedIn: auth.kind === 'in', login, logout }
}
