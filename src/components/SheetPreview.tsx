import styled from 'styled-components'
import type { CardData } from '../common/types'
import { CARDS_PER_SHEET } from '../common/constants'
import { CARD_RADIUS_PX, CARD_WIDTH_PX, SongCard } from './SongCard'

// ─── Styled Components ────────────────────────────────────────────────────────

const PreviewSection = styled.div`
  margin-top: 28px;
`

const SheetRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const ScrollBtn = styled.button`
  width: 32px;
  height: 32px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  color: #555;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  align-self: center;

  &:hover:not(:disabled) {
    background: #e8e8e8;
    border-color: #bbb;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }

  @media print {
    display: none;
  }
`

const CardGrid = styled.div`
  display: inline-flex;
  flex-direction: row;
  gap: 10px;

  @media print {
    gap: 0;
  }
`

const CardPairWrapper = styled.div<{ $selected: boolean; $clickable?: boolean }>`
  display: flex;
  flex-direction: column;
  outline: ${p => p.$selected ? '3px solid #1db954' : 'none'};
  outline-offset: 0px;
  border-radius: ${CARD_RADIUS_PX}px;
  cursor: ${p => p.$clickable ? 'pointer' : 'default'};

  @media print {
    outline: none;
  }
`

// Empty slot that pads a partial sheet in the preview. A single dashed rectangle
// (no height set) that stretches to the row's height via CardGrid's flex layout,
// so it spans a full card pair with rounded outer corners and no middle seam.
const SheetSlotPlaceholder = styled.div`
  width: ${CARD_WIDTH_PX}px;
  border: 1px dashed #ccc;
  border-radius: ${CARD_RADIUS_PX}px;
  background: #fafafa;
`

// Hidden container: renders all cards off-screen for PDF capture
const HiddenCards = styled.div`
  position: fixed;
  top: -9999px;
  left: -9999px;
  display: flex;
  flex-direction: column;
  pointer-events: none;
`

// ─── SheetPreview ───────────────────────────────────────────────────────────────

interface SheetPreviewProps {
  cards: CardData[]
  selectedId: number | null
  onSelect: (id: number) => void
  onFieldChange: (id: number, field: 'name' | 'artist' | 'year', value: string) => void
}

export function SheetPreview({ cards, selectedId, onSelect, onFieldChange }: SheetPreviewProps) {
  const selectedCard = cards.find(c => c.id === selectedId) ?? null
  const selectedIndex = selectedCard ? cards.findIndex(c => c.id === selectedId) : -1
  const selectedSheetIndex = selectedIndex >= 0 ? Math.ceil((selectedIndex + 1) / CARDS_PER_SHEET) : null
  const totalSheets = Math.ceil(cards.length / CARDS_PER_SHEET)

  // Cards on the sheet containing the selected card (always layout mode)
  const sheetCards: (CardData | null)[] = selectedSheetIndex !== null
    ? Array.from({ length: CARDS_PER_SHEET }, (_, i) => {
        const idx = (selectedSheetIndex - 1) * CARDS_PER_SHEET + i
        return cards[idx] ?? null
      })
    : []

  const handleScrollSheet = (direction: 'prev' | 'next') => {
    if (selectedSheetIndex === null) return
    const targetSheet = direction === 'next' ? selectedSheetIndex + 1 : selectedSheetIndex - 1
    const firstCardIdx = (targetSheet - 1) * CARDS_PER_SHEET
    const firstCard = cards[firstCardIdx]
    if (firstCard) onSelect(firstCard.id)
  }

  // Cards NOT currently shown in the preview need to be rendered hidden for PDF capture
  const visibleIds = new Set<number>()
  if (selectedCard) {
    sheetCards.forEach(c => c && visibleIds.add(c.id))
  }
  const hiddenCards = cards.filter(c => !visibleIds.has(c.id))

  const canScrollPrev = selectedSheetIndex !== null && selectedSheetIndex > 1
  const canScrollNext = selectedSheetIndex !== null && selectedSheetIndex < totalSheets

  return (
    <>
      {/* Sheet preview with flanking scroll buttons */}
      {selectedCard && (
        <PreviewSection>
          <SheetRow>
            <ScrollBtn
              onClick={() => handleScrollSheet('prev')}
              disabled={!canScrollPrev}
              title="Previous sheet"
            >
              ‹
            </ScrollBtn>
            <CardGrid>
              {sheetCards.map((card, i) =>
                card
                  ? (
                    <CardPairWrapper
                      key={`pair-${card.id}`}
                      $selected={card.id === selectedId}
                      $clickable
                      onClick={() => onSelect(card.id)}
                    >
                      <SongCard
                        editable
                        card={card}
                        onFieldChange={(field, value) => onFieldChange(card.id, field, value)}
                      />
                    </CardPairWrapper>
                  )
                  : <SheetSlotPlaceholder key={`ph-${i}`} />
              )}
            </CardGrid>
            <ScrollBtn
              onClick={() => handleScrollSheet('next')}
              disabled={!canScrollNext}
              title="Next sheet"
            >
              ›
            </ScrollBtn>
          </SheetRow>
        </PreviewSection>
      )}

      {/* Hidden cards rendered off-screen for PDF capture */}
      <HiddenCards aria-hidden="true">
        {hiddenCards.map(card => (
          <div key={card.id}>
            <SongCard editable={false} card={card} />
          </div>
        ))}
      </HiddenCards>
    </>
  )
}
