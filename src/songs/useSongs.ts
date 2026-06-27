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
//
// Selection model (no hidden state — everything below is visible):
//   selectedIds  - the multi-selection set (green / operated-on); may be empty.
//   previewId    - the single "current song": what the preview pages to and the
//                  blue list marker. Moves on any row / preview-card / checkbox
//                  click; survives an empty selection (unselect-all leaves it put).
//   shift anchor - NOT stored: it's the topmost selected song, derived from the set.
export interface SongsInterface {
  cards: CardData[]
  selectedIds: Set<number>
  previewId: number | null
  // Plain row / preview-card click: collapse to a single-selection of `id`.
  selectSingle: (id: number) => void
  // Checkbox click: toggle `id` in/out of the selection; makes it the current song.
  toggleSelect: (id: number) => void
  // Shift-click a checkbox: ADD the block from the topmost selected song to `id`
  // (just `id` when nothing is selected). Only ever grows the selection.
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
  const [input, setInput] = useState('')
  const [importing, setImporting] = useState(false)
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
      selectSingle(newCards[0].id)
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
  // `id`. Otherwise it unions a contiguous block from the topmost selected song
  // (the first selected card in list order — the derived anchor) through `id`.
  const selectRange = (id: number) => {
    setSelectedIds(prev => {
      if (prev.size === 0) return new Set([id])
      const topIdx = cards.findIndex(c => prev.has(c.id))
      const clickIdx = cards.findIndex(c => c.id === id)
      if (topIdx === -1 || clickIdx === -1) return prev
      const span = cards.slice(Math.min(topIdx, clickIdx), Math.max(topIdx, clickIdx) + 1)
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

    // The song to fall back to: the remaining song just before the first deleted
    // one, else the first remaining song after it, else nothing.
    const firstDelIdx = cards.findIndex(c => toDelete.has(c.id))
    const remainingBefore = cards.slice(0, firstDelIdx).filter(c => !toDelete.has(c.id)).length
    const remaining = cards.filter(c => !toDelete.has(c.id))
    const neighbor = remaining[remainingBefore - 1]?.id ?? remaining[remainingBefore]?.id ?? null

    setCards(prev => prev.filter(c => !toDelete.has(c.id)))

    if (deletingSelection) {
      // The whole selection is gone; collapse to a single-selection of the
      // fallback song so there's somewhere to continue from.
      setSelectedIds(neighbor !== null ? new Set([neighbor]) : new Set())
      setPreviewId(neighbor)
    } else if (previewId === id) {
      // Deleted a non-selected row; only move the current song if it was that row.
      setPreviewId(neighbor)
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
