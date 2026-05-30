// ─────────────────────────────────────────────────────────────────────────────
// USER-TOKEN WORLD — playlist reading
//
// Playlist endpoints return 403 for the client-credentials token, so this must
// use a logged-in user token. Every function here takes an authenticated
// SpotifyApi instance, which makes "playlist import requires login" enforced by
// the type system: regular-mode code has no SpotifyApi to pass.
// ─────────────────────────────────────────────────────────────────────────────

import type { SpotifyApi } from '@spotify/web-api-ts-sdk'
import type { TrackInfo } from './spotify'

export interface PlaylistTrack {
  trackId: string
  trackInfo: TrackInfo
}

// Extract a playlist ID from a URL, URI, or bare ID.
export function extractPlaylistId(input: string): string {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/)
  if (urlMatch) return urlMatch[1]
  if (trimmed.includes(':')) return (trimmed.split(':').pop() || trimmed).split('?')[0]
  return trimmed.split('?')[0]
}

// Fetch all tracks from a playlist, following pagination. Requires a logged-in
// SDK instance. Skips local/unavailable items and non-track entries (episodes).
export async function fetchPlaylistTracks(
  sdk: SpotifyApi,
  playlistId: string,
): Promise<PlaylistTrack[]> {
  const results: PlaylistTrack[] = []
  const limit = 50
  let offset = 0

  for (;;) {
    const fields = 'items(track(id,name,type,artists(name),album(release_date))),total'
    const page = await sdk.playlists.getPlaylistItems(
      playlistId,
      undefined, // market (optional)
      fields,
      limit as 50,
      offset,
    )

    const items = page.items ?? []
    for (const item of items) {
      const t = item.track as unknown as {
        id: string | null
        name: string
        type?: string
        artists: { name: string }[]
        album: { release_date: string }
      } | null

      // Skip nulls, local tracks (no id), and podcast episodes (type !== 'track').
      if (!t || !t.id) continue
      if (t.type && t.type !== 'track') continue

      results.push({
        trackId: t.id,
        trackInfo: {
          name: t.name,
          artist: Array.isArray(t.artists) ? t.artists.map(a => a.name).join(', ') : '',
          year: t.album?.release_date ? t.album.release_date.substring(0, 4) : '',
        },
      })
    }

    const total = page.total ?? items.length
    offset += limit
    if (offset >= total || items.length === 0) break
  }

  return results
}
