import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { CardData } from '../common/types'
import { STAGGER_MS } from '../common/constants'

// What useSelectAndDelete needs from the song domain. The card list is the live
// useSongs state (read for selection math, mutated by delete), passed straight
// through so the behavior runs unchanged, exactly where it did before.
interface SelectAndDeleteDeps {
  cards: CardData[]
  setCards: Dispatch<SetStateAction<CardData[]>>
}

// The selection & deletion slice of the song domain: the multi-selection set,
// the single preview focus, the click handlers that move them, and the delete
// that removes a row or the whole selection. Split out of useSongs purely to
// shrink it — the behavior is identical.
//
// Selection model (no hidden state — everything below is visible):
//   selectedIds  - the multi-selection set (green / operated-on); may be empty.
//   previewId    - the single "current song": what the preview pages to and the
//                  blue list marker. Moves on any row / preview-card / checkbox
//                  click; survives an empty selection (unselect-all leaves it put).
//   shift anchor - NOT stored: it's the nearest selected song to the click
//                  (above if any, else below), derived from the set.
export interface SelectAndDeleteInterface {
  selectedIds: Set<number>
  previewId: number | null
  // Exposed so useSongs can wire the preview-follow into useSpotifyImport (each
  // imported card becomes the preview focus). Not part of the public SongsInterface.
  setPreviewId: Dispatch<SetStateAction<number | null>>
  selectSingle: (id: number) => void
  toggleSelect: (id: number) => void
  selectRange: (id: number) => void
  toggleSelectAll: () => void
  navigatePreview: (id: number) => void
  // handleDelete removes one specific song (regardless of selection);
  // handleDeleteSelected removes the whole current selection.
  handleDelete: (id: number) => void
  handleDeleteSelected: () => void
}

export function useSelectAndDelete(deps: SelectAndDeleteDeps): SelectAndDeleteInterface {
  const { cards, setCards } = deps
  // Multi-selection (green / operated-on); may be empty.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  // The "current song": what the preview pages to. Decoupled from selectedIds so
  // it survives an empty selection; moves on any row / preview / checkbox click.
  const [previewId, setPreviewId] = useState<number | null>(null)

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

  // Delete a set of songs: pick the preview's fallback target, remove the rows one
  // at a time (top first, STAGGER_MS apart) so the user watches them vanish, then
  // drop the deleted ids from the selection.
  const deleteCards = (toDelete: Set<number>) => {
    if (toDelete.size === 0) return

    // The song the preview falls back to when the focused one is deleted: the
    // remaining song just before the first deleted one, else the first after it.
    const firstDelIdx = cards.findIndex(c => toDelete.has(c.id))
    const remainingBefore = cards.slice(0, firstDelIdx).filter(c => !toDelete.has(c.id)).length
    const remaining = cards.filter(c => !toDelete.has(c.id))
    const neighbor = remaining[remainingBefore - 1]?.id ?? remaining[remainingBefore]?.id ?? null

    // Keep the preview from blanking out: move it to the survivor only when the
    // focused song is itself being removed.
    if (previewId !== null && toDelete.has(previewId)) setPreviewId(neighbor)

    // Remove the rows one at a time, top first (STAGGER_MS apart). Selected rows
    // stay green as they go, so the user watches the selection shrink and vanish.
    const orderedIds = cards.filter(c => toDelete.has(c.id)).map(c => c.id)
    orderedIds.forEach((delId, i) => {
      setTimeout(() => setCards(prev => prev.filter(c => c.id !== delId)), i * STAGGER_MS)
    })

    // Drop the deleted ids from the selection once the last row has gone — only if
    // any were actually selected, to avoid a needless state update.
    if (orderedIds.some(id => selectedIds.has(id))) {
      setTimeout(() => setSelectedIds(prev => {
        const next = new Set(prev)
        orderedIds.forEach(id => next.delete(id))
        return next
      }), orderedIds.length * STAGGER_MS)
    }
  }

  // List trash button: delete just this one song, whether or not it's selected.
  const handleDelete = (id: number) => deleteCards(new Set([id]))

  // Top trash button: delete every selected song at once.
  const handleDeleteSelected = () => deleteCards(new Set(selectedIds))

  return {
    selectedIds,
    previewId,
    setPreviewId,
    selectSingle,
    toggleSelect,
    selectRange,
    toggleSelectAll,
    navigatePreview,
    handleDelete,
    handleDeleteSelected,
  }
}
