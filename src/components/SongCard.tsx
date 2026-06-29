import styled from 'styled-components'
import { QRCodeSVG } from 'qrcode.react'
import type { CardData, EditableField } from '../common/types'

// Card pixel dimensions — the single source of truth, also imported by
// pdfGenerator.ts so the PDF capture matches the on-screen card exactly.
export const CARD_WIDTH_PX = 159
const CARD_HEIGHT_PX = 222
export const CARD_RADIUS_PX = 8

// ─── Card styled-components ─────────────────────────────────────────────────────

const Card = styled.div`
  width: ${CARD_WIDTH_PX}px;
  height: ${CARD_HEIGHT_PX}px;
  border: 1px solid #333;
  border-radius: ${CARD_RADIUS_PX}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: white;
  overflow: hidden;
`

const CardNote = styled.div`
  font-size: 2.0rem;
  color: #3fdf0a;
  margin-bottom: 4px;
`

const SongName = styled.div`
  font-size: 0.95rem;
  font-weight: 600;
  color: #cd0000;
  text-align: center;
  padding: 0 12px;
  margin-bottom: 6px;
  word-break: break-word;
  cursor: text;
  outline: none;
  min-width: 20px;

  &:hover { outline: 1px dashed #ccc; }
  &:focus { outline: 1px dashed #999; }
`

const ArtistName = styled.div`
  font-size: 0.8rem;
  color: #002a9c;
  text-align: center;
  padding: 0 12px;
  margin-bottom: 10px;
  cursor: text;
  outline: none;
  min-width: 20px;

  &:hover { outline: 1px dashed #ccc; }
  &:focus { outline: 1px dashed #999; }
`

const YearText = styled.div`
  font-size: 0.75rem;
  color: #0f3460;
  font-weight: 500;
  cursor: text;
  outline: none;
  min-width: 20px;

  &:hover { outline: 1px dashed #ccc; }
  &:focus { outline: 1px dashed #999; }
`

const QrCardContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: rotate(180deg);
  width: 100%;
  height: 100%;
  gap: 12px;
`

const GameCardLabel = styled.div`
  font-size: 0.75rem;
  color: #3fdf0a;
  font-weight: 500;
  letter-spacing: 1px;
`

// ─── SongCard (both faces) ──────────────────────────────────────────────────────

interface SongCardProps {
  card: CardData
  // When true, the front's three text fields are contentEditable and report edits
  // via onFieldChange. When false (the off-screen PDF-capture render), they are
  // plain static text — the screenshot is identical either way, so the print path
  // carries no interactive markup. The ♫ note is always static.
  editable: boolean
  onFieldChange?: (field: EditableField, value: string) => void
}

// Renders both faces of a card as sibling nodes (front detail + back QR). They are
// captured independently by pdfGenerator.ts via the data-pdf-* attributes, and the
// caller's wrapper (selection outline / plain div) stacks them. A Fragment adds no
// DOM, so the faces become direct children of whatever wrapper the call site uses.
export function SongCard({ card, editable, onFieldChange }: SongCardProps) {
  // Applied to each field only when editable; same elements/styles otherwise.
  const editProps = (field: EditableField) =>
    editable
      ? {
          contentEditable: true,
          suppressContentEditableWarning: true,
          // Enter accepts the edit: prevent the newline and blur to commit.
          onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
          },
          onBlur: (e: React.FocusEvent<HTMLDivElement>) =>
            onFieldChange?.(field, e.currentTarget.textContent ?? ''),
        }
      : {}

  return (
    <>
      <Card data-pdf-detail={String(card.id)}>
        <CardNote>♫</CardNote>
        <SongName {...editProps('name')}>{card.trackInfo.name}</SongName>
        <ArtistName {...editProps('artist')}>{card.trackInfo.artist}</ArtistName>
        <YearText {...editProps('year')}>{card.trackInfo.year}</YearText>
      </Card>
      <Card data-pdf-qr={String(card.id)}>
        <QrCardContent>
          <GameCardLabel>My Song Cards</GameCardLabel>
          <QRCodeSVG value={card.spotifyUri} size={120} />
        </QrCardContent>
      </Card>
    </>
  )
}
