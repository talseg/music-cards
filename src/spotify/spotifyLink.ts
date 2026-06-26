// Pure parser that infers the import type from a Spotify link's type keyword.
// The single extension point for new import kinds — add a kind here and a branch
// in useSongs.handleImport.

export type SpotifyLinkKind = 'track' | 'playlist' | 'album' | 'liked'

// `id` is null only for 'liked' (open.spotify.com/collection/tracks has no id).
export interface SpotifyLink {
  kind: SpotifyLinkKind
  id: string | null
}

// Track & album are public endpoints (client-credentials token); playlist & liked
// are user-scoped and require a logged-in user token.
export const LINK_NEEDS_LOGIN: Record<SpotifyLinkKind, boolean> = {
  track: false,
  album: false,
  playlist: true,
  liked: true,
}

// Accepts open.spotify.com URLs (with optional /intl-xx/ segment and ?si=… query)
// and spotify: URIs. Bare IDs are not accepted — there's no type keyword to infer
// from. Returns null for anything unrecognized.
export function parseSpotifyLink(raw: string): SpotifyLink | null {
  const s = raw.trim()
  if (!s) return null

  // Liked songs — no id.
  if (/open\.spotify\.com\/(?:intl-[a-z]+\/)?collection\/tracks|spotify:collection:tracks/i.test(s)) {
    return { kind: 'liked', id: null }
  }

  // URL form: open.spotify.com/[intl-xx/]{type}/{id}
  const urlMatch = s.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|playlist|album)\/([A-Za-z0-9]+)/i)
  if (urlMatch) return { kind: urlMatch[1].toLowerCase() as SpotifyLinkKind, id: urlMatch[2] }

  // URI form: spotify:{type}:{id}
  const uriMatch = s.match(/spotify:(track|playlist|album):([A-Za-z0-9]+)/i)
  if (uriMatch) return { kind: uriMatch[1].toLowerCase() as SpotifyLinkKind, id: uriMatch[2] }

  return null
}
