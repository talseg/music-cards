import type { TrackInfo } from './spotify'

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
