import { useState } from 'react'
import styled from 'styled-components'
import { trackIdOf } from '../common/helpers'
import type { CardData } from '../common/types'
import type { AiState } from '../ai/useAiDates'

type EditableField = 'name' | 'artist' | 'year'

// ─── Song List Row ──────────────────────────────────────────────────────────────

// A row. `$selected` = part of the multi-selection (green, like the preview
// outline). `$preview` = the single song the preview is focused on; marked with
// a left accent bar so it's identifiable even when it isn't selected. The bar is
// always 3px (transparent when off) so rows don't shift between the two states.
const ListItem = styled.div<{ $selected: boolean; $preview: boolean }>`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  border-left: 3px solid ${p => p.$preview ? '#0052cc' : 'transparent'};
  cursor: pointer;
  background: ${p => p.$selected ? '#e6f7ec' : 'white'};
  font-weight: ${p => p.$selected ? 700 : 400};
  color: ${p => p.$selected ? '#0a7a3c' : '#333'};
  gap: 8px;
  user-select: none;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${p => p.$selected ? '#d6f0e0' : '#f7f7f7'};
  }
`

const ListItemNum = styled.span`
  font-size: 0.75rem;
  color: #aaa;
  width: 22px;
  flex-shrink: 0;
  text-align: right;
`

const ListItemName = styled.span`
  flex: 1;
  font-size: 0.88rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const ListItemArtist = styled.span`
  font-size: 0.8rem;
  color: #777;
  flex-shrink: 0;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const ListItemYear = styled.span`
  font-size: 0.78rem;
  color: #aaa;
  flex-shrink: 0;
  width: 36px;
  text-align: right;
`

const ListItemYearSource = styled.span<{ $match: boolean | null; $clickable: boolean }>`
  font-size: 0.78rem;
  color: ${p => p.$match === null ? '#888' : p.$match ? '#2a6' : '#cc0000'};
  font-weight: ${p => p.$match === null ? 400 : 600};
  flex-shrink: 0;
  width: 44px;
  text-align: right;
  cursor: ${p => p.$clickable ? 'pointer' : 'default'};
`

const ListItemCard = styled.span`
  font-size: 0.78rem;
  color: #555;
  flex-shrink: 0;
  width: 44px;
  text-align: right;
`

const ListItemCost = styled.span`
  font-size: 0.72rem;
  color: #aaa;
  flex-shrink: 0;
  width: 48px;
  text-align: right;
`

// The row's selection hit-zone: wraps the checkbox AND the song number, and
// stretches to fill the row's full height (the negative margins cancel the
// ListItem's 8px vertical and 12px left padding) so clicks anywhere over the
// checkbox, the number, or the blank space above/below them toggle the
// selection instead of single-selecting the row. A copy/cell cursor marks the
// zone as distinct from the rest of the row (which uses the default pointer).
const CheckZone = styled.div`
  display: flex;
  align-items: center;
  align-self: stretch;
  gap: 8px;
  margin: -8px 0 -8px -12px;
  padding: 0 0 0 12px;
  cursor: copy;
`

// Checkbox shared by the header (select-all) and each row, sized to the column.
const RowCheckbox = styled.input`
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin: 0;
  cursor: inherit;
`

const CopyBtn = styled.button`
  font-size: 0.75rem;
  width: 22px;
  height: 22px;
  border: 1px solid #ddd;
  border-radius: 3px;
  background: white;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;

  &:hover {
    background: #e8f4ff;
    border-color: #99c;
    color: #33c;
  }
`

const DeleteBtn = styled.button`
  font-size: 1rem;
  width: 22px;
  height: 22px;
  border: 1px solid #ddd;
  border-radius: 3px;
  background: white;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;

  &:hover {
    background: #fee;
    border-color: #f99;
    color: #c33;
  }
`

// The in-place editor swapped in for a cell on double-click. It inherits the
// cell's font/color/alignment so the row layout doesn't shift between viewing
// and editing; the caller passes the matching size via inline style.
const EditInput = styled.input`
  font: inherit;
  color: inherit;
  text-align: inherit;
  border: 1px solid #0052cc;
  border-radius: 3px;
  background: white;
  padding: 0 2px;
  margin: -1px 0;
  outline: none;
  box-sizing: border-box;
`

interface SongListRowProps {
  card: CardData
  // 0-based index of this card in the list; rendered as the 1-based number.
  index: number
  selected: boolean
  preview: boolean
  // Undefined when the AI-dates feature is disabled; its presence drives the
  // extra year/cost columns (see useAiDates).
  ai?: AiState
  // Registers/unregisters this row's DOM node with the parent so it can be
  // scrolled into view when it becomes the preview focus.
  rowRef: (node: HTMLDivElement | null) => void
  onSelectSingle: (id: number) => void
  onToggle: (id: number) => void
  onRange: (id: number) => void
  // Commits an edited / applied field (name, artist, or year) for this card.
  onApplyField: (id: number, field: EditableField, value: string) => void
  onDelete: (id: number) => void
}

export function SongListRow({
  card,
  index,
  selected,
  preview,
  ai,
  rowRef,
  onSelectSingle,
  onToggle,
  onRange,
  onApplyField,
  onDelete,
}: SongListRowProps) {
  const aiDate = ai ? ai.aiDates.get(trackIdOf(card)) : undefined
  const querying = !!ai && ai.webSearchingId === trackIdOf(card)
  const aiError = typeof aiDate?.year === 'string'
  const spotifyMatch = card.spotifyYear === card.trackInfo.year.trim()
  const aiMatch = !!aiDate && !aiError &&
    String(aiDate.year) === card.trackInfo.year.trim()

  // Which cell, if any, is currently being edited (double-click to enter). Only
  // one cell per row edits at a time.
  const [editing, setEditing] = useState<EditableField | null>(null)

  // Renders one editable cell: the styled span normally (double-click to edit),
  // or an in-place input while `editing === field`. Enter / blur commits the
  // trimmed value (only when it actually changed); Esc reverts without saving.
  // Clicks are stopped from bubbling so editing never single-selects the row.
  const EditableCell = (
    field: EditableField,
    Span: typeof ListItemName,
    width: number,
  ) => {
    if (editing === field) {
      return (
        <EditInput
          autoFocus
          defaultValue={card.trackInfo[field]}
          style={{ width }}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur()
            else if (e.key === 'Escape') {
              // Mark as cancelled so the blur it triggers skips the commit.
              e.currentTarget.dataset.cancel = '1'
              e.currentTarget.blur()
            }
          }}
          onBlur={e => {
            const cancelled = e.currentTarget.dataset.cancel === '1'
            const value = e.currentTarget.value.trim()
            if (!cancelled && value !== card.trackInfo[field]) {
              onApplyField(card.id, field, value)
            }
            setEditing(null)
          }}
        />
      )
    }
    return (
      <Span
        title="Double-click to edit"
        onDoubleClick={e => { e.stopPropagation(); setEditing(field) }}
      >
        {card.trackInfo[field]}
      </Span>
    )
  }

  return (
    <ListItem
      ref={rowRef}
      $selected={selected}
      $preview={preview}
      onClick={() => onSelectSingle(card.id)}
    >
      <CheckZone
        // The whole zone is the hit target: shift adds a range up to this
        // row, a plain click toggles just this row. stopPropagation keeps
        // the row's single-select from firing.
        onClick={e => {
          e.stopPropagation()
          if (e.shiftKey) onRange(card.id)
          else onToggle(card.id)
        }}
      >
        <RowCheckbox
          type="checkbox"
          checked={selected}
          onChange={() => {}}
        />
        <ListItemNum>{index + 1}</ListItemNum>
      </CheckZone>
      {EditableCell('name', ListItemName, 240)}
      {EditableCell('artist', ListItemArtist, 200)}
      {ai ? (
        <>
          <ListItemYearSource
            $match={spotifyMatch}
            $clickable={!spotifyMatch}
            onClick={!spotifyMatch ? () => {
              onApplyField(card.id, 'year', card.spotifyYear)
            } : undefined}
          >
            {card.spotifyYear}
          </ListItemYearSource>
          <ListItemYearSource
            $match={aiDate ? aiMatch : null}
            $clickable={!querying && !!aiDate && !aiError && !aiMatch}
            onClick={!querying && aiDate && !aiError && !aiMatch ? () => {
              onApplyField(card.id, 'year', String(aiDate.year))
            } : undefined}
          >
            {querying ? '…' : aiDate ? aiDate.year : '----'}
          </ListItemYearSource>
          {EditableCell('year', ListItemCard, 44)}
          <ListItemCost>
            {aiDate ? (aiDate.cost * 100).toFixed(3) : ''}
          </ListItemCost>
        </>
      ) : (
        EditableCell('year', ListItemYear, 44)
      )}
      <CopyBtn
        title="Copy song name search string to clipboard"
        onClick={() => {
          navigator.clipboard.writeText(`song ${card.trackInfo.name} ${card.trackInfo.artist} first official release date`)
        }}
        >
        ⧉
      </CopyBtn>
      <DeleteBtn
        title="Remove"
        onClick={e => { e.stopPropagation(); onDelete(card.id) }}
      >
        −
      </DeleteBtn>
    </ListItem>
  )
}
