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
  // Get the user token from the SDK, but call the endpoint directly:
  // the SDK (v1.2.0) still uses the deprecated /tracks endpoint, which now
  // returns 403 after Spotify's Feb/Mar 2026 migration. /items is the replacement.
  const tokenObj = await sdk.getAccessToken()
  const token = tokenObj?.access_token
  if (!token) throw new Error('Not logged in')

  const results: PlaylistTrack[] = []
  const limit = 100
  let offset = 0

  for (;;) {
    const url =
      `https://api.spotify.com/v1/playlists/${playlistId}/items` +
      `?limit=${limit}&offset=${offset}`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      if (res.status === 404) throw new Error('Playlist not found.')
      throw new Error(`Spotify playlist fetch failed: ${res.status}`)
    }

    const data = await res.json()
    const items: unknown[] = data.items ?? []

    for (const entry of items) {
      // New shape: entry.item ; legacy fallback: entry.track
      const e = entry as { item?: unknown; track?: unknown }
      const t = (e.item ?? e.track) as {
        id: string | null
        name: string
        type?: string
        artists: { name: string }[]
        album: { release_date: string }
      } | null

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

    const total: number = data.total ?? items.length
    offset += limit
    if (offset >= total || items.length === 0) break
  }

  return results
}
