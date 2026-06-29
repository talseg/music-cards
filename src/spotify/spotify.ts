// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC / CLIENT-CREDENTIALS WORLD — track & album reading
//
// These endpoints are public, so they use an app-only client-credentials token
// (no login required). The token is fetched from the proxy and cached in-module
// until just before it expires. The user-token counterpart (playlists, liked
// songs) lives in spotify-user.ts.
// ─────────────────────────────────────────────────────────────────────────────

let accessToken: string | null = null
let tokenExpiry = 0

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken
  }

  const response = await fetch('/api/spotify/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.status}`)
  }

  const data = await response.json()
  accessToken = data.access_token
  // Expire it a minute early so an in-flight request never races the real expiry.
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000

  return accessToken!
}

export interface TrackInfo {
  name: string
  artist: string
  year: string
}

// A track ready to be turned into a card. The common currency returned by every
// importer (single track, playlist, album, …) and consumed by useSongs.
export interface ImportedTrack {
  trackId: string
  trackInfo: TrackInfo
}

export async function fetchTrackInfo(trackId: string): Promise<TrackInfo> {
  const token = await getAccessToken()

  const response = await fetch(`/api/spotify/tracks/${trackId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Spotify track fetch failed: ${response.status}`)
  }

  const data = await response.json()

  return {
    name: data.name,
    artist: data.artists.map((a: { name: string }) => a.name).join(', '),
    year: data.album.release_date.substring(0, 4),
  }
}

// Simplified track as returned inside an album (no album/release_date of its own).
interface AlbumTrackItem {
  id: string | null
  name: string
  artists: { name: string }[]
}

// Fetch all tracks of an album. Album data is public, so this uses the
// client-credentials token (no login). The album's release_date is the year for
// every track — the /albums/{id}/tracks items don't carry one themselves. The
// album object only embeds the first page of tracks, so we page the rest.
export async function fetchAlbumTracks(albumId: string): Promise<ImportedTrack[]> {
  const token = await getAccessToken()
  const headers = { Authorization: `Bearer ${token}` }

  const albumRes = await fetch(`/api/spotify/albums/${albumId}`, { headers })
  if (!albumRes.ok) {
    if (albumRes.status === 404) throw new Error('Album not found.')
    throw new Error(`Spotify album fetch failed: ${albumRes.status}`)
  }
  const album = await albumRes.json()
  const year: string = album.release_date ? String(album.release_date).substring(0, 4) : ''

  const results: ImportedTrack[] = []
  const push = (items: AlbumTrackItem[]) => {
    for (const t of items) {
      if (!t || !t.id) continue
      results.push({
        trackId: t.id,
        trackInfo: {
          name: t.name,
          artist: Array.isArray(t.artists) ? t.artists.map(a => a.name).join(', ') : '',
          year,
        },
      })
    }
  }

  push(album.tracks?.items ?? [])

  const total: number = album.tracks?.total ?? results.length
  let offset: number = album.tracks?.items?.length ?? 0
  while (offset < total) {
    const res = await fetch(`/api/spotify/albums/${albumId}/tracks?limit=50&offset=${offset}`, { headers })
    if (!res.ok) throw new Error(`Spotify album tracks fetch failed: ${res.status}`)
    const page = await res.json()
    const items: AlbumTrackItem[] = page.items ?? []
    if (items.length === 0) break
    push(items)
    offset += items.length
  }

  return results
}
