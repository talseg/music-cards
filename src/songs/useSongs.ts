import { useState, useRef, useEffect } from 'react'
import type { Dispatch, SetStateAction, RefObject } from 'react'
import { fetchTrackInfo, fetchAlbumTracks } from '../spotify/spotify'
import type { ImportedTrack } from '../spotify/spotify'
import type { CardData } from '../common/types'
import { generatePdf } from '../pdfGenerator'
import { sdk } from '../auth/useAuth'
import { fetchPlaylistTracks, fetchLikedTracks } from '../spotify/spotify-user'
import { parseSpotifyLink, LINK_NEEDS_LOGIN } from '../spotify/spotifyLink'

// App-data localStorage key. Deliberately lives OUTSIDE the 'music-cards:' auth
// namespace: clearStoredAuth() (on logout, and on the expired/stale-token paths
// during mount) sweeps every key under that prefix, which would otherwise wipe
// this too.
const SONG_COUNTER_KEY = 'music-cards-app:songCounter'

// The song domain exposed to the app. The return shape of useSongs.
export interface SongsInterface {
  cards: CardData[]
  selectedId: number | null
  setSelectedId: Dispatch<SetStateAction<number | null>>
  songCounter: number
  setSongCounter: Dispatch<SetStateAction<number>>
  input: string
  setInput: Dispatch<SetStateAction<string>>
  importing: boolean
  importDisabled: boolean
  importDisabledReason: string
  pdfLoading: boolean
  error: string | null
  clearError: () => void
  inputRef: RefObject<HTMLInputElement | null>
  handleImport: () => Promise<void>
  handleDelete: (id: number) => void
  updateCardField: (id: number, field: 'name' | 'artist' | 'year', value: string) => void
  handleGeneratePdf: () => Promise<void>
  handleClearSongs: () => void
}

// Owns the song domain: the card list, selection, the persisted song counter,
// and every operation that mutates them (add / import / delete / edit / clear /
// PDF export). Mirrors useAuth / useAiDates — App just consumes what it returns.
// `loggedIn` comes from useAuth and gates the playlist-import feature.
export function useSongs(loggedIn: boolean) : SongsInterface {
  const [input, setInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [cards, setCards] = useState<CardData[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [songCounter, setSongCounter] = useState(() => {
    const stored = localStorage.getItem(SONG_COUNTER_KEY)
    const parsed = Number(stored)
    return stored && Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
  })
  const [pdfLoading, setPdfLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(1)

  const clearError = () => setError(null)

  useEffect(() => {
    localStorage.setItem(SONG_COUNTER_KEY, String(songCounter))
  }, [songCounter])

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

      const existing = new Set(cards.map(c => c.spotifyUri.split(':').pop() || ''))
      const newCards: CardData[] = []
      for (const t of tracks) {
        if (existing.has(t.trackId)) continue
        existing.add(t.trackId)
        newCards.push({
          id: nextId.current++,
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

      setCards(prev => [...prev, ...newCards])
      setSelectedId(newCards[0].id)
      setSongCounter(prev => prev + newCards.length)
      setInput('')
      if (link.kind === 'track') inputRef.current?.focus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import')
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = (id: number) => {
    // If the deleted card is selected, move selection to the card after it
    // (or the one before, or nothing). Computed here from current state rather
    // than inside the setCards updater, which must stay side-effect free.
    if (selectedId === id) {
      const idx = cards.findIndex(c => c.id === id)
      const remaining = cards.filter(c => c.id !== id)
      const nextCard = remaining[idx] ?? remaining[idx - 1] ?? null
      setSelectedId(nextCard ? nextCard.id : null)
    }
    setCards(prev => prev.filter(c => c.id !== id))
    setSongCounter(prev => Math.max(1, prev - 1))
  }

  const updateCardField = (id: number, field: 'name' | 'artist' | 'year', value: string) => {
    setCards(prev => prev.map(c =>
      c.id === id
        ? { ...c, trackInfo: { ...c.trackInfo, [field]: value } }
        : c
    ))
  }

  const handleGeneratePdf = async () => {
    if (cards.length === 0) return
    setPdfLoading(true)
    setError(null)
    try {
      await generatePdf(
        cards.map(c => ({ spotifyUri: c.spotifyUri, trackInfo: c.trackInfo })),
        cards.map(c => c.id)
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const handleClearSongs = () => {
    // Mirrors deleting every song one by one: the cards are removed but the
    // aiDates entries (keyed by track id) are kept, so re-adding a song — or
    // re-importing a playlist it's in — restores its previous AI year/cost.
    setCards([])
    setSelectedId(null)
    setError(null)
  }

  return {
    cards,
    selectedId,
    setSelectedId,
    songCounter,
    setSongCounter,
    input,
    setInput,
    importing,
    importDisabled,
    importDisabledReason,
    pdfLoading,
    error,
    clearError,
    inputRef,
    handleImport,
    handleDelete,
    updateCardField,
    handleGeneratePdf,
    handleClearSongs,
  }
}
