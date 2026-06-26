import { useRef, useEffect } from 'react'
import styled from 'styled-components'
import { DATES_ENABLED } from '../common/constants'
import { trackIdOf } from '../common/helpers'
import type { CardData, AiState } from '../common/types'

// ─── Song List ────────────────────────────────────────────────────────────────

const ListPanel = styled.div`
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
`

const DISPLAY_LONG_LIST = true;
const LIST_HEIGHT = DISPLAY_LONG_LIST ? 650 : 192;

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

const ListItem = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  background: ${p => p.$selected ? '#e8f4ff' : 'white'};
  font-weight: ${p => p.$selected ? 700 : 400};
  color: ${p => p.$selected ? '#0052cc' : '#333'};
  gap: 8px;
  user-select: none;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${p => p.$selected ? '#d4ecff' : '#f7f7f7'};
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

const HeadNum = styled.span`width: 22px; flex-shrink: 0; text-align: right;`
const HeadName = styled.span`flex: 1;`
const HeadArtist = styled.span`width: 160px; flex-shrink: 0;`
const HeadSpotify = styled.span`width: 44px; flex-shrink: 0; text-align: right;`
const HeadAi = styled.span`width: 26px; flex-shrink: 0; text-align: right;`
const HeadCard = styled.span`width: 54px; flex-shrink: 0; text-align: right;`
const HeadCost = styled.span`width: 56px; flex-shrink: 0; text-align: right;`
const HeadSearch = styled.span`width: 28px; flex-shrink: 0;`
const HeadCopy = styled.span`width: 22px; flex-shrink: 0;`
const HeadDelete = styled.span`width: 22px; flex-shrink: 0;`

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

const SearchBtn = styled.button`
  font-size: 0.7rem;
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

  &:hover:not(:disabled) {
    background: #e8f0ff;
    border-color: #99c;
    color: #33c;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
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

interface SongListProps {
  cards: CardData[]
  selectedId: number | null
  ai: AiState
  onSelect: (id: number) => void
  onApplyYear: (id: number, year: string) => void
  onDelete: (id: number) => void
}

export function SongList({
  cards,
  selectedId,
  ai,
  onSelect,
  onApplyYear,
  onDelete,
}: SongListProps) {
  const { aiDates, webSearchEnabled, webSearchingId, onWebSearch } = ai
  // Maps each card id to its <ListItem> DOM node, so we can scroll the
  // selected song into view in the list whenever the selection changes.
  const listItemRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Whenever the selected song changes, make sure its row is visible in the
  // list. Covers adding a song, clicking a preview card, and the sheet arrows.
  useEffect(() => {
    if (selectedId === null) return
    const node = listItemRefs.current.get(selectedId)
    node?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  return (
    <ListPanel className='list_panel'>
      {DATES_ENABLED && cards.length > 0 && (
        <ListHeader>
          <HeadNum>#</HeadNum>
          <HeadName>Song</HeadName>
          <HeadArtist>Artist</HeadArtist>
          <HeadSpotify>Spotify</HeadSpotify>
          <HeadAi>AI</HeadAi>
          <HeadCard>Card</HeadCard>
          <HeadCost>cents</HeadCost>
          <HeadSearch />
          <HeadCopy />
          <HeadDelete />
        </ListHeader>
      )}
      <ListScroll className='list_scroll'>
        {cards.length === 0
          ? <ListEmpty>No songs yet — paste a Spotify URL above and press Add</ListEmpty>
          : cards.map((card, idx) => {
            const ai = DATES_ENABLED ? aiDates.get(trackIdOf(card)) : undefined
            const aiError = typeof ai?.year === 'string'
            const spotifyMatch = card.spotifyYear === card.trackInfo.year.trim()
            const aiMatch = !!ai && !aiError &&
              String(ai.year) === card.trackInfo.year.trim()
            return (
            <ListItem
              key={card.id}
              ref={node => {
                if (node) listItemRefs.current.set(card.id, node)
                else listItemRefs.current.delete(card.id)
              }}
              $selected={card.id === selectedId}
              onClick={() => onSelect(card.id)}
            >
              <ListItemNum>{idx + 1}</ListItemNum>
              <ListItemName>{card.trackInfo.name}</ListItemName>
              <ListItemArtist>{card.trackInfo.artist}</ListItemArtist>
              {DATES_ENABLED && (
                <>
                  <ListItemYearSource
                    $match={spotifyMatch}
                    $clickable={!spotifyMatch}
                    onClick={!spotifyMatch ? () => {
                      onApplyYear(card.id, card.spotifyYear)
                    } : undefined}
                  >
                    {card.spotifyYear}
                  </ListItemYearSource>
                  <ListItemYearSource
                    $match={ai ? aiMatch : null}
                    $clickable={!!ai && !aiError && !aiMatch}
                    onClick={ai && !aiError && !aiMatch ? () => {
                      onApplyYear(card.id, String(ai.year))
                    } : undefined}
                  >
                    {ai ? ai.year : '----'}
                  </ListItemYearSource>
                  <ListItemCard>{card.trackInfo.year}</ListItemCard>
                  <ListItemCost>
                    {ai ? (ai.cost * 100).toFixed(3) : ''}
                  </ListItemCost>
                </>
              )}
              {!DATES_ENABLED && (
                <ListItemYear>{card.trackInfo.year}</ListItemYear>
              )}
              <CopyBtn
                title="Copy song name search string to clipboard"
                onClick={() => {
                  navigator.clipboard.writeText(`song ${card.trackInfo.name} ${card.trackInfo.artist} first official release date`)
                }}
                >
                ⧉
              </CopyBtn>
              {DATES_ENABLED && webSearchEnabled && (
                <SearchBtn
                  title="Web search for release year"
                  disabled={webSearchingId === trackIdOf(card)}
                  onClick={() => {
                    onWebSearch(card)
                  }}
                >
                  {webSearchingId === trackIdOf(card) ? '…' : '🔍'}
                </SearchBtn>
              )}
              <DeleteBtn
                title="Remove"
                onClick={e => { e.stopPropagation(); onDelete(card.id) }}
              >
                −
              </DeleteBtn>
            </ListItem>
            )
          })
        }
      </ListScroll>
    </ListPanel>
  )
}
