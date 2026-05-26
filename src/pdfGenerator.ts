import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

// Standard playing card: 63.5mm × 88.9mm
const CARD_W_MM = 63.5
const CARD_H_MM = 88.9

export async function generatePdf(): Promise<void> {
  const detailsRow = document.querySelector<HTMLElement>('.cards-row-details')
  const qrRow = document.querySelector<HTMLElement>('.cards-row-qr')

  if (!detailsRow || !qrRow) {
    throw new Error('Card rows not found in preview')
  }

  const detailCards = detailsRow.querySelectorAll<HTMLElement>(':scope > *')
  const qrCards = qrRow.querySelectorAll<HTMLElement>(':scope > *')
  const count = detailCards.length

  if (count === 0) {
    throw new Error('No cards to export')
  }

  // Capture each card individually for precise placement
  const detailImages = await Promise.all(
    Array.from(detailCards).map((el) =>
      html2canvas(el, { scale: 4, backgroundColor: '#ffffff', logging: false })
        .then((c) => c.toDataURL('image/png'))
    )
  )

  const qrImages = await Promise.all(
    Array.from(qrCards).map((el) =>
      html2canvas(el, { scale: 4, backgroundColor: '#ffffff', logging: false })
        .then((c) => c.toDataURL('image/png'))
    )
  )

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Center the cards horizontally on A4 (210mm wide)
  const totalWidth = count * CARD_W_MM
  const startX = (210 - totalWidth) / 2

  // Center the two rows vertically on A4 (297mm tall)
  const totalHeight = CARD_H_MM * 2
  const startY = (297 - totalHeight) / 2

  // Top row: detail cards
  for (let i = 0; i < count; i++) {
    doc.addImage(detailImages[i], 'PNG', startX + i * CARD_W_MM, startY, CARD_W_MM, CARD_H_MM)
  }

  // Bottom row: QR cards
  for (let i = 0; i < count; i++) {
    doc.addImage(qrImages[i], 'PNG', startX + i * CARD_W_MM, startY + CARD_H_MM, CARD_W_MM, CARD_H_MM)
  }

  doc.save('music-cards.pdf')
}
