import { useState, useRef, useEffect } from 'react'
import type { Dispatch, SetStateAction, RefObject } from 'react'
import type { CardData } from '../common/types'
import { generatePdf } from '../pdfGenerator'
import { useSpotifyImport } from './useSpotifyImport'
import { useSelectAndDelete } from './useSelectAndDelete'

// App-data localStorage key. Deliberately lives OUTSIDE the 'music-cards:' auth
// namespace: clearStoredAuth() (on logout, and on the expired/stale-token paths
// during mount) sweeps every key under that prefix, which would otherwise wipe
// this too.
const SONG_COUNTER_KEY = 'music-cards-app:songCounter'

// The song domain exposed to the app. The return shape of useSongs.
//
// Selection model (no hidden state — everything below is visible):
//   selectedIds  - the multi-selection set (green / operated-on); may be empty.
//   previewId    - the single "current song": what the preview pages to and the
//                  blue list marker. Moves on any row / preview-card / checkbox
//                  click; survives an empty selection (unselect-all leaves it put).
//   shift anchor - NOT stored: it's the nearest selected song to the click
//                  (above if any, else below), derived from the set.
export interface SongsInterface {
  cards: CardData[]
  selectedIds: Set<number>
  previewId: number | null
  // Plain row / preview-card click: collapse to a single-selection of `id`.
  selectSingle: (id: number) => void
  // Checkbox click: toggle `id` in/out of the selection; makes it the current song.
  toggleSelect: (id: number) => void
  // Shift-click a checkbox: ADD the block bridging `id` to the nearest selected
  // song (the one above if any, else the one below). Just `id` when nothing is
  // selected. Only ever grows the selection.
  selectRange: (id: number) => void
  // Header checkbox: anything selected ⇒ clear; only an empty selection selects all.
  toggleSelectAll: () => void
  // Sheet arrows: move the preview without touching the selection.
  navigatePreview: (id: number) => void
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
}

// Owns the song domain: the card list, selection, the persisted song counter,
// and every operation that mutates them (add / import / delete / edit / clear /
// PDF export). Mirrors useAuth / useAiDates — App just consumes what it returns.
// `loggedIn` comes from useAuth and gates the playlist-import feature.
export function useSongs(loggedIn: boolean) : SongsInterface {
  const [cards, setCards] = useState<CardData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [songCounter, setSongCounter] = useState(() => {
    const stored = localStorage.getItem(SONG_COUNTER_KEY)
    const parsed = Number(stored)
    return stored && Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
  })
  const [pdfLoading, setPdfLoading] = useState(false)
  const nextIdRef = useRef(1)

  const clearError = () => setError(null)

  useEffect(() => {
    localStorage.setItem(SONG_COUNTER_KEY, String(songCounter))
  }, [songCounter])

  // The selection & deletion slice (the multi-selection set, the preview focus,
  // the click handlers that move them, and delete). It owns selectedIds /
  // previewId; setPreviewId is threaded into useSpotifyImport below so imports
  // keep following the last-added song. Behavior is unchanged.
  const {
    selectedIds,
    previewId,
    setPreviewId,
    selectSingle,
    toggleSelect,
    selectRange,
    toggleSelectAll,
    navigatePreview,
    handleDelete,
  } = useSelectAndDelete({ cards, setCards })

  // The Spotify-import slice (paste input, in-flight flag, disabled gating,
  // handleImport). It commits successful imports straight into this hook's state
  // via the setters passed below, so the append / preview-follow / counter
  // behavior is unchanged.
  const {
    input,
    setInput,
    importing,
    importDisabled,
    importDisabledReason,
    inputRef,
    handleImport,
  } = useSpotifyImport({
    loggedIn,
    cards,
    setCards,
    setPreviewId,
    setSongCounter,
    setError,
    nextIdRef,
  })

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

  return {
    cards,
    selectedIds,
    previewId,
    selectSingle,
    toggleSelect,
    selectRange,
    toggleSelectAll,
    navigatePreview,
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
  }
}
