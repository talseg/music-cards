import { useRef, useEffect } from 'react'
import styled from 'styled-components'
import type { CardData, EditableField } from '../common/types'
import type { AiState } from '../ai/useAiDates'
import { DISPLAY_LONG_LIST } from '../common/constants'
import { RowCheckbox } from '../common/shared.styles'
import { SongListRow } from './SongListRow'

// ─── Song List ────────────────────────────────────────────────────────────────

const ListPanel = styled.div`
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
`

const LIST_HEIGHT = DISPLAY_LONG_LIST ? 650 : 238;

const ListScroll = styled.div`
  max-height: ${LIST_HEIGHT}px;
  overflow-y: auto;
  background: white;
`

const ListEmpty = styled.div`
  padding: 20px 16px;
  font-size: 0.85rem;
  color: #aaa;
  text-align: center;
`

// Header row above the song list. Column widths mirror the cells in each
// ListItem so labels sit over their values.
const ListHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 6px 12px;
  gap: 8px;
  background: #f7f7f7;
  border-bottom: 1px solid #e4e4e4;
  font-size: 0.68rem;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  user-select: none;
`

const HeadCheck = styled.span`width: 16px; flex-shrink: 0; display: flex; align-items: center;`
const HeadNum = styled.span`width: 22px; flex-shrink: 0; text-align: right;`

// Header select-all hit-zone: the counterpart to the rows' CheckZone. Wraps the
// header checkbox AND the '#' label and stretches to fill the header's full
// height (the negative margins cancel ListHeader's 6px vertical and 12px left
// padding) so clicking anywhere over them toggles select-all, with the same copy
// cursor as a row's select zone.
const HeadCheckZone = styled.div`
  display: flex;
  align-items: center;
  align-self: stretch;
  gap: 8px;
  margin: -6px 0 -6px -12px;
  padding: 0 0 0 12px;
  cursor: copy;
`
const HeadName = styled.span`flex: 1;`
const HeadArtist = styled.span`width: 60px; flex-shrink: 0;`
const HeadSpotify = styled.span`width: 44px; flex-shrink: 0; text-align: right;`
const HeadAi = styled.span`width: 28px; flex-shrink: 0; text-align: right;`
const HeadCard = styled.span`width: 52px; flex-shrink: 0; text-align: right;`
const HeadCost = styled.span`width: 50px; flex-shrink: 0; text-align: right;`
const HeadCopy = styled.span`width: 34px; flex-shrink: 0;`
const HeadDelete = styled.span`width: 22px; flex-shrink: 0;`

interface SongListProps {
  cards: CardData[]
  // The multi-selection set (green rows) and the single preview-focused song.
  selectedIds: Set<number>
  previewId: number | null
  // Undefined when the AI-dates feature is disabled; its presence drives the
  // extra year/cost columns (see useAiDates).
  ai?: AiState
  // Plain row click → single-select. Checkbox → toggle; shift-checkbox → range;
  // header checkbox → select-all / clear.
  onSelectSingle: (id: number) => void
  onToggle: (id: number) => void
  onRange: (id: number) => void
  onToggleAll: () => void
  onApplyField: (id: number, field: EditableField, value: string) => void
  onDelete: (id: number) => void
}

// The song list: a header row (select-all + column labels) over the scrollable
// list of SongListRows. Keeps the preview-focused row scrolled into view.
export function SongList({
  cards,
  selectedIds,
  previewId,
  ai,
  onSelectSingle,
  onToggle,
  onRange,
  onToggleAll,
  onApplyField,
  onDelete,
}: SongListProps) {
  // Maps each card id to its <ListItem> DOM node, so we can scroll the
  // preview-focused song into view in the list whenever it changes.
  const listItemRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Whenever the preview focus changes, make sure its row is visible in the
  // list. Covers adding a song, clicking a preview card, and the sheet arrows.
  useEffect(() => {
    if (previewId === null) return
    const node = listItemRefs.current.get(previewId)
    node?.scrollIntoView({ block: 'nearest' })
  }, [previewId])

  // Header checkbox: checked when every song is selected, indeterminate when only
  // some are. (The DOM `indeterminate` flag isn't settable in JSX — set via ref.)
  const allSelected = cards.length > 0 && selectedIds.size === cards.length

  return (
    <ListPanel className='list_panel'>
      {cards.length > 0 && (
        <ListHeader>
          <HeadCheckZone onClick={onToggleAll} title="Select all / clear selection">
            <HeadCheck>
              <RowCheckbox
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && !allSelected }}
                onChange={() => {}}
              />
            </HeadCheck>
            <HeadNum>#</HeadNum>
          </HeadCheckZone>
          <HeadName>Song</HeadName>
          <HeadArtist>Artist</HeadArtist>
          {ai && (
            <>
              <HeadSpotify>Spotify</HeadSpotify>
              <HeadAi>AI</HeadAi>
              <HeadCard>Card</HeadCard>
              <HeadCost>cents</HeadCost>
            </>
          )}
          <HeadCopy />
          <HeadDelete />
        </ListHeader>
      )}
      <ListScroll className='list_scroll'>
        {cards.length === 0
          ? <ListEmpty>No songs yet — paste a Spotify URL above and press Add</ListEmpty>
          : cards.map((card, idx) => (
            <SongListRow
              key={card.id}
              card={card}
              index={idx}
              selected={selectedIds.has(card.id)}
              preview={card.id === previewId}
              ai={ai}
              rowRef={node => {
                if (node) listItemRefs.current.set(card.id, node)
                else listItemRefs.current.delete(card.id)
              }}
              onSelectSingle={onSelectSingle}
              onToggle={onToggle}
              onRange={onRange}
              onApplyField={onApplyField}
              onDelete={onDelete}
            />
          ))
        }
      </ListScroll>
    </ListPanel>
  )
}
