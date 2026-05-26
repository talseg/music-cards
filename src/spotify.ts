const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET

let accessToken: string | null = null
let tokenExpiry = 0

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken
  }

  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)

  const response = await fetch('/api/spotify/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.status}`)
  }

  const data = await response.json()
  accessToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000

  return accessToken!
}

export interface TrackInfo {
  name: string
  artist: string
  year: string
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
