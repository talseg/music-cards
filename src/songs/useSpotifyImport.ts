import { useState, useRef } from 'react'
import type { Dispatch, SetStateAction, RefObject } from 'react'
import { fetchTrackInfo, fetchAlbumTracks } from '../spotify/spotify'
import type { ImportedTrack } from '../spotify/spotify'
import type { CardData } from '../common/types'
import { sdk } from '../auth/useAuth'
import { fetchPlaylistTracks, fetchLikedTracks } from '../spotify/spotify-user'
import { parseSpotifyLink, LINK_NEEDS_LOGIN } from '../spotify/spotifyLink'
import { STAGGER_MS } from '../common/constants'
import { trackIdOf } from '../common/helpers'

// What useSpotifyImport needs from the song domain to commit a successful import:
// the live useSongs state setters and reads it writes new cards through.
interface ImportDeps {
  loggedIn: boolean
  cards: CardData[]
  setCards: Dispatch<SetStateAction<CardData[]>>
  setPreviewId: Dispatch<SetStateAction<number | null>>
  setSongCounter: Dispatch<SetStateAction<number>>
  setError: Dispatch<SetStateAction<string | null>>
  nextIdRef: RefObject<number>
}

// The Spotify-import slice of the song domain: the paste input, the in-flight
// flag, the import-disabled gating, and handleImport itself. `loggedIn` gates the
// playlist / liked-songs import features.
export interface SpotifyImportInterface {
  input: string
  setInput: Dispatch<SetStateAction<string>>
  importing: boolean
  importDisabled: boolean
  importDisabledReason: string
  inputRef: RefObject<HTMLInputElement | null>
  handleImport: () => Promise<void>
}

export function useSpotifyImport(deps: ImportDeps): SpotifyImportInterface {
  const { loggedIn, cards, setCards, setPreviewId, setSongCounter, setError, nextIdRef } = deps
  const [input, setInput] = useState('')
  const [importing, setImporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const link = parseSpotifyLink(input)
  const importDisabled =
    importing || !input.trim() || (link !== null && LINK_NEEDS_LOGIN[link.kind] && !loggedIn)
  const importDisabledReason =
    link !== null && LINK_NEEDS_LOGIN[link.kind] && !loggedIn
      ? 'Must be logged in to import this link'
      : ''

  // Fetch tracks for the pasted link and add the new ones to the list. The import
  // type is inferred from the link: track, album, playlist, and liked songs are
  // all supported.
  const handleImport = async () => {
    if (!link) {
      setError('Unrecognized Spotify link. Paste a track, album, or playlist URL.')
      return
    }
    if (LINK_NEEDS_LOGIN[link.kind] && !loggedIn) return

    setImporting(true)
    setError(null)

    try {
      let tracks: ImportedTrack[]
      if (link.kind === 'track') {
        const trackInfo = await fetchTrackInfo(link.id!)
        tracks = [{ trackId: link.id!, trackInfo }]
      } else if (link.kind === 'album') {
        tracks = await fetchAlbumTracks(link.id!)
      } else if (link.kind === 'playlist') {
        tracks = await fetchPlaylistTracks(sdk, link.id!)
      } else {
        tracks = await fetchLikedTracks(sdk)
      }

      const existing = new Set(cards.map(trackIdOf))
      const newCards: CardData[] = []
      for (const t of tracks) {
        if (existing.has(t.trackId)) continue
        existing.add(t.trackId)
        newCards.push({
          id: nextIdRef.current++,
          spotifyUri: `spotify:track:${t.trackId}`,
          spotifyYear: t.trackInfo.year,
          trackInfo: t.trackInfo,
        })
      }

      if (newCards.length === 0) {
        setError(link.kind === 'track'
          ? 'That song is already in the list.'
          : 'No new songs to add (all tracks are already in the list).')
        return
      }

      // Append the new rows one at a time, top first (STAGGER_MS apart), so the
      // bunch appears gradually instead of popping in all at once — mirroring how
      // a multi-delete staggers removal. Each appended card also becomes the
      // preview focus, so the list scrolls to follow the last added song (imports
      // start with nothing selected — only the preview moves).
      newCards.forEach((card, i) => {
        setTimeout(() => {
          setCards(prev => [...prev, card])
          setPreviewId(card.id)
        }, i * STAGGER_MS)
      })
      setInput('')
      if (link.kind === 'track') {
        setSongCounter(prev => prev + 1)
        inputRef.current?.focus()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import')
    } finally {
      setImporting(false)
    }
  }

  return {
    input,
    setInput,
    importing,
    importDisabled,
    importDisabledReason,
    inputRef,
    handleImport,
  }
}
