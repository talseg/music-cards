import type { TrackInfo } from '../logic/spotify'

export interface CardData {
  id: number
  spotifyUri: string
  spotifyYear: string
  trackInfo: TrackInfo
}

// Transient AI-date result for one song, keyed by Spotify track id. Deliberately
// NOT part of CardData and NOT persisted (resets on reload). Entries are kept
// when a song is removed, so re-adding it restores its previous AI result rather
// than re-querying. `year` holds the parsed 4-digit year, or the literal 'Error'
// marker on a failed call.
export interface AiDate {
  year: 'Error' | 'Unknown' | number
  // Cumulative cost (USD) of every query run on this song — the initial
  // "Get AI dates" plus each subsequent web search.
  cost: number
}

// Auth phase for the (non-blocking) login feature.
//   'checking' - verifying a stored token / handling the OAuth callback on mount
//   'out'      - not logged in; regular mode (login optional)
//   'in'       - logged in and profile confirmed; playlist feature enabled
export type AuthState =
  | { kind: 'checking' }
  | { kind: 'out'; error: string | null }
  | { kind: 'in'; user: string }

// 'running' = a get-dates pass is in flight; 'pausing' = pause requested but the
// current song's call is still finishing; 'paused' = a pass was interrupted with
// songs still unqueried; 'idle' = nothing running.
export type AiStatus = 'idle' | 'running' | 'pausing' | 'paused'
