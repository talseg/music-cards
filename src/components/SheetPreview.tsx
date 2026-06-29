import styled from 'styled-components'
import type { CardData, EditableField } from '../common/types'
import { CARDS_PER_SHEET } from '../common/constants'
import { CARD_RADIUS_PX, CARD_WIDTH_PX, SongCard } from './SongCard'

// ─── Styled Components ────────────────────────────────────────────────────────

const PreviewSection = styled.div`
  margin-top: 16px;
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

// One column of the sheet: the card pair stacked above its list-position label.
const CardCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`

// The card's 1-based place in the list, shown under the card pair. Lives here in
// the preview only — it's outside the data-pdf-* capture targets, so it never
// prints. Font matches the song-number column in the list (SongList ListItemNum).
const CardPosition = styled.div`
  font-size: 0.75rem;
  color: #aaa;
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

// Hidden container: renders the off-sheet cards off-screen so the PDF capture has
// a node for every card (the on-sheet ones are captured from the visible preview).
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
  // The multi-selection (every selected card gets a green outline) and the
  // single song the preview pages to.
  selectedIds: Set<number>
  previewId: number | null
  // Clicking a card single-selects it; the sheet arrows only move the preview.
  onSelect: (id: number) => void
  onNavigate: (id: number) => void
  onFieldChange: (id: number, field: EditableField, value: string) => void
}

// The printable-sheet preview: shows the one sheet (a CARDS_PER_SHEET grid of card
// pairs) that contains the preview-focused card, with arrows to page between
// sheets. Cards on other sheets are still rendered hidden off-screen so
// pdfGenerator can capture every card on export.
export function SheetPreview({ cards, selectedIds, previewId, onSelect, onNavigate, onFieldChange }: SheetPreviewProps) {
  const previewCard = cards.find(c => c.id === previewId) ?? null
  const previewIndex = previewCard ? cards.findIndex(c => c.id === previewId) : -1
  const previewSheetIndex = previewIndex >= 0 ? Math.ceil((previewIndex + 1) / CARDS_PER_SHEET) : null
  const totalSheets = Math.ceil(cards.length / CARDS_PER_SHEET)

  // Each card's 1-based place in the list, shown under the card pair in the preview.
  const positionById = new Map(cards.map((c, i) => [c.id, i + 1]))

  // Cards on the sheet containing the preview-focused card (always layout mode)
  const sheetCards: (CardData | null)[] = previewSheetIndex !== null
    ? Array.from({ length: CARDS_PER_SHEET }, (_, i) => {
        const idx = (previewSheetIndex - 1) * CARDS_PER_SHEET + i
        return cards[idx] ?? null
      })
    : []

  const handleScrollSheet = (direction: 'prev' | 'next') => {
    if (previewSheetIndex === null) return
    const targetSheet = direction === 'next' ? previewSheetIndex + 1 : previewSheetIndex - 1
    const firstCardIdx = (targetSheet - 1) * CARDS_PER_SHEET
    const firstCard = cards[firstCardIdx]
    if (firstCard) onNavigate(firstCard.id)
  }

  // Cards NOT currently shown in the preview need to be rendered hidden for PDF capture
  const visibleIds = new Set<number>()
  if (previewCard) {
    sheetCards.forEach(c => c && visibleIds.add(c.id))
  }
  const hiddenCards = cards.filter(c => !visibleIds.has(c.id))

  const canScrollPrev = previewSheetIndex !== null && previewSheetIndex > 1
  const canScrollNext = previewSheetIndex !== null && previewSheetIndex < totalSheets

  return (
    <>
      {/* Sheet preview with flanking scroll buttons */}
      {previewCard && (
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
                    <CardCell key={`cell-${card.id}`}>
                      <CardPairWrapper
                        $selected={selectedIds.has(card.id)}
                        $clickable
                        onClick={() => onSelect(card.id)}
                      >
                        <SongCard
                          editable
                          card={card}
                          onFieldChange={(field, value) => onFieldChange(card.id, field, value)}
                        />
                      </CardPairWrapper>
                      <CardPosition>{positionById.get(card.id)}</CardPosition>
                    </CardCell>
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
