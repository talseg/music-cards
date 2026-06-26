import { useState, useRef, useEffect } from 'react'
import { fetchTrackInfo } from '../spotify/spotify'
import type { CardData } from '../common/types'
import { generatePdf } from '../pdfGenerator'
import { sdk } from '../auth/useAuth'
import { extractPlaylistId, fetchPlaylistTracks } from '../spotify/spotify-user'

// App-data localStorage key. Deliberately lives OUTSIDE the 'music-cards:' auth
// namespace: clearStoredAuth() (on logout, and on the expired/stale-token paths
// during mount) sweeps every key under that prefix, which would otherwise wipe
// this too.
const SONG_COUNTER_KEY = 'music-cards-app:songCounter'

function extractTrackId(input: string): string {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/)
  if (urlMatch) return urlMatch[1]
  if (trimmed.includes(':')) return trimmed.split(':').pop() || trimmed
  return trimmed
}

// Owns the song domain: the card list, selection, the persisted song counter,
// and every operation that mutates them (add / import / delete / edit / clear /
// PDF export). Mirrors useAuth / useAiDates — App just consumes what it returns.
// `loggedIn` comes from useAuth and gates the playlist-import feature.
export function useSongs(loggedIn: boolean) {
  const [urlInput, setUrlInput] = useState('')
  const [playlistInput, setPlaylistInput] = useState('')
  const [playlistLoading, setPlaylistLoading] = useState(false)
  const [cards, setCards] = useState<CardData[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
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

  const handleImportPlaylist = async () => {
    if (!loggedIn) return
    const raw = playlistInput.trim()
    if (!raw) return
    const playlistId = extractPlaylistId(raw)
    if (!playlistId) return

    setPlaylistLoading(true)
    setError(null)

    try {
      const tracks = await fetchPlaylistTracks(sdk, playlistId)
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
        setError('No new songs to add (all tracks are already in the list).')
        return
      }

      setCards(prev => [...prev, ...newCards])
      setSelectedId(newCards[0].id)
      setSongCounter(prev => prev + newCards.length)
      setPlaylistInput('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import playlist')
    } finally {
      setPlaylistLoading(false)
    }
  }

  const handleAdd = async () => {
    const raw = urlInput.trim()
    if (!raw) return
    const trackId = extractTrackId(raw)
    if (!trackId) return

    const existing = new Set(cards.map(c => c.spotifyUri.split(':').pop() || ''))
    if (existing.has(trackId)) {
      setError('That song is already in the list.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const trackInfo = await fetchTrackInfo(trackId)
      const id = nextId.current++
      const newCard: CardData = { id, spotifyUri: `spotify:track:${trackId}`, spotifyYear: trackInfo.year, trackInfo }
      setCards(prev => [...prev, newCard])
      setSelectedId(id)
      setUrlInput('')
      setSongCounter(prev => prev + 1)
      inputRef.current?.focus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch track info')
    } finally {
      setLoading(false)
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
    urlInput,
    setUrlInput,
    playlistInput,
    setPlaylistInput,
    loading,
    playlistLoading,
    pdfLoading,
    error,
    clearError,
    inputRef,
    handleImportPlaylist,
    handleAdd,
    handleDelete,
    updateCardField,
    handleGeneratePdf,
    handleClearSongs,
  }
}
