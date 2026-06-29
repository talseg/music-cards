import { useState, useRef, useEffect } from 'react'
import type { Dispatch, SetStateAction, RefObject } from 'react'
import type { CardData, EditableField } from '../common/types'
import { generatePdf } from '../pdfGenerator'
import { useSpotifyImport } from './useSpotifyImport'
import { useSelectAndDelete } from './useSelectAndDelete'

// App-data localStorage key. Deliberately lives OUTSIDE the 'music-cards:' auth
// namespace: clearStoredAuth() (on logout, and on the expired/stale-token paths
// during mount) sweeps every key under that prefix, which would otherwise wipe
// this too.
const SONG_COUNTER_KEY = 'music-cards-app:songCounter'

// The flat surface App consumes: the card list plus everything the two sub-hooks
// (useSelectAndDelete, useSpotifyImport) expose. The return shape of useSongs;
// re-exposed fields are documented in the sub-hook that owns them.
export interface SongsInterface {
  cards: CardData[]
  selectedIds: Set<number>
  previewId: number | null
  selectSingle: (id: number) => void
  toggleSelect: (id: number) => void
  selectRange: (id: number) => void
  toggleSelectAll: () => void
  navigatePreview: (id: number) => void
  songCounter: number
  setSongCounter: Dispatch<SetStateAction<number>>
  input: string
  setInput: Dispatch<SetStateAction<string>>
  importing: boolean
  importDisabled: boolean
  importDisabledReason: string
  pdfLoading: boolean
  pdfProgress: { done: number; total: number } | null
  error: string | null
  clearError: () => void
  inputRef: RefObject<HTMLInputElement | null>
  handleImport: () => Promise<void>
  handleDelete: (id: number) => void
  updateCardField: (id: number, field: EditableField, value: string) => void
  handleGeneratePdf: () => Promise<void>
}

// Composes the song domain into the single surface App consumes. Owns the card
// list, the persisted song counter, field edits and PDF export; delegates
// selection + delete to useSelectAndDelete and importing to useSpotifyImport.
// Mirrors useAuth / useAiDates — App just consumes what it returns. `loggedIn`
// comes from useAuth and gates the playlist-import feature.
export function useSongs(loggedIn: boolean) : SongsInterface {
  const [cards, setCards] = useState<CardData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [songCounter, setSongCounter] = useState(() => {
    const stored = localStorage.getItem(SONG_COUNTER_KEY)
    const parsed = Number(stored)
    return stored && Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
  })
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null)
  const nextIdRef = useRef(1)

  const clearError = () => setError(null)

  useEffect(() => {
    localStorage.setItem(SONG_COUNTER_KEY, String(songCounter))
  }, [songCounter])

  // Selection + delete. It owns previewId, which the import slice below also
  // drives (each imported card becomes the preview), so it's composed first to
  // hand setPreviewId down.
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

  // Spotify import. It writes new cards (and bumps the counter / preview) through
  // the setters handed in below.
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

  const updateCardField = (id: number, field: EditableField, value: string) => {
    setCards(prev => prev.map(c =>
      c.id === id
        ? { ...c, trackInfo: { ...c.trackInfo, [field]: value } }
        : c
    ))
  }

  const handleGeneratePdf = async () => {
    if (cards.length === 0) return
    setPdfLoading(true)
    setPdfProgress({ done: 0, total: cards.length })
    setError(null)
    try {
      await generatePdf(
        cards.map(c => ({ spotifyUri: c.spotifyUri, trackInfo: c.trackInfo })),
        cards.map(c => c.id),
        (done, total) => setPdfProgress({ done, total })
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF')
    } finally {
      setPdfLoading(false)
      setPdfProgress(null)
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
    pdfProgress,
    error,
    clearError,
    inputRef,
    handleImport,
    handleDelete,
    updateCardField,
    handleGeneratePdf,
  }
}
