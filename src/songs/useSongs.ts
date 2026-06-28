import { useState, useRef, useEffect } from 'react'
import type { Dispatch, SetStateAction, RefObject } from 'react'
import type { CardData } from '../common/types'
import { generatePdf } from '../pdfGenerator'
import { STAGGER_MS } from '../common/constants'
import { useSpotifyImport } from './useSpotifyImport'

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
  // Multi-selection (green / operated-on); may be empty.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  // The "current song": what the preview pages to. Decoupled from selectedIds so
  // it survives an empty selection; moves on any row / preview / checkbox click.
  const [previewId, setPreviewId] = useState<number | null>(null)
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

  // Plain row / preview-card click: collapse to a single-selection of `id`,
  // which also becomes the current song (preview focus).
  const selectSingle = (id: number) => {
    setSelectedIds(new Set([id]))
    setPreviewId(id)
  }

  // Checkbox click: toggle `id` in/out of the selection, and make it the current
  // song so the preview follows what you just touched (no invisible stuck focus).
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setPreviewId(id)
  }

  // Shift-click a checkbox: only ever ADDS. With nothing selected it just selects
  // `id`. Otherwise it unions a contiguous block bridging `id` to the nearest
  // selected song — the closest one above the click (the derived anchor), falling
  // back to the closest one below when none is above.
  const selectRange = (id: number) => {
    setSelectedIds(prev => {
      if (prev.size === 0) return new Set([id])
      const clickIdx = cards.findIndex(c => c.id === id)
      if (clickIdx === -1) return prev
      // Nearest selected above the click; else nearest selected below.
      let anchorIdx = -1
      for (let i = clickIdx - 1; i >= 0; i--) {
        if (prev.has(cards[i].id)) { anchorIdx = i; break }
      }
      if (anchorIdx === -1) {
        for (let i = clickIdx + 1; i < cards.length; i++) {
          if (prev.has(cards[i].id)) { anchorIdx = i; break }
        }
      }
      if (anchorIdx === -1) return new Set([...prev, id])
      const span = cards.slice(Math.min(anchorIdx, clickIdx), Math.max(anchorIdx, clickIdx) + 1)
      return new Set([...prev, ...span.map(c => c.id)])
    })
    setPreviewId(id)
  }

  // Header checkbox: anything selected ⇒ clear (unselect); only an empty selection
  // selects all. The current song / preview is left where it is.
  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size > 0 ? new Set() : new Set(cards.map(c => c.id)))
  }

  // Sheet arrows: move the preview focus only; the selection is untouched.
  const navigatePreview = (id: number) => setPreviewId(id)

  const handleDelete = (id: number) => {
    // Minus on a selected row removes the whole selection; on a non-selected row
    // it removes just that one song (the selection stays intact).
    const deletingSelection = selectedIds.has(id)
    const toDelete = deletingSelection ? new Set(selectedIds) : new Set<number>([id])

    // The song the preview falls back to when the focused one is deleted: the
    // remaining song just before the first deleted one, else the first after it.
    const firstDelIdx = cards.findIndex(c => toDelete.has(c.id))
    const remainingBefore = cards.slice(0, firstDelIdx).filter(c => !toDelete.has(c.id)).length
    const remaining = cards.filter(c => !toDelete.has(c.id))
    const neighbor = remaining[remainingBefore - 1]?.id ?? remaining[remainingBefore]?.id ?? null

    // Keep the preview from blanking out: move it to the survivor only when the
    // focused song is itself being removed.
    if (previewId !== null && toDelete.has(previewId)) setPreviewId(neighbor)

    // Remove the rows one at a time, top first (DELETE_STAGGER_MS apart). The rows
    // stay selected (green) as they go, so the user watches the selection shrink
    // and vanish.
    const orderedIds = cards.filter(c => toDelete.has(c.id)).map(c => c.id)
    orderedIds.forEach((delId, i) => {
      setTimeout(() => setCards(prev => prev.filter(c => c.id !== delId)), i * STAGGER_MS)
    })

    // Nothing stays selected after a delete: clear the selection once the last
    // green row has gone.
    if (deletingSelection) {
      setTimeout(() => setSelectedIds(new Set()), orderedIds.length * STAGGER_MS)
    }
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
