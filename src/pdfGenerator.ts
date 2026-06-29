// PDF export: lays the cards out for printing on A4-landscape sheets, four cards
// per sheet, as a row of detail faces above a row of matching QR faces (so a
// duplex print pairs each song with its QR on the back). Each face is rasterised
// to PNG with html2canvas — preferring the live React-rendered node (tagged
// data-pdf-detail / data-pdf-qr by SongCard), and falling back to building the
// detail face from an HTML string when no live node exists.

import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { TrackInfo } from './spotify/spotify'
import { CARDS_PER_SHEET } from './common/constants'

// Standard playing card: 63.5mm × 88.9mm
const CARD_W_MM = 63.5
const CARD_H_MM = 88.9

export interface CardInput {
  spotifyUri: string
  trackInfo: TrackInfo
}

// Capture the QR card element directly from the live DOM (already rendered by React)
async function captureQrFromDom(cardId: string): Promise<string | null> {
  const el = document.querySelector<HTMLElement>(`[data-pdf-qr="${cardId}"]`)
  if (!el) return null
  const canvas = await html2canvas(el, {
    scale: 4,
    backgroundColor: '#ffffff',
    logging: false,
  })
  return canvas.toDataURL('image/png')
}

async function captureDetailFromDom(cardId: string): Promise<string | null> {
  const el = document.querySelector<HTMLElement>(`[data-pdf-detail="${cardId}"]`)
  if (!el) return null
  const canvas = await html2canvas(el, {
    scale: 4,
    backgroundColor: '#ffffff',
    logging: false,
  })
  return canvas.toDataURL('image/png')
}

export async function generatePdf(
  cards: CardInput[],
  cardIds: number[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (cards.length === 0) throw new Error('No cards to export')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const PAGE_W = 297
  const PAGE_H = 210

  // Split into sheets of CARDS_PER_SHEET
  const sheets: { card: CardInput; id: number }[][] = []
  for (let i = 0; i < cards.length; i += CARDS_PER_SHEET) {
    const slice = cards.slice(i, i + CARDS_PER_SHEET).map((c, j) => ({ card: c, id: cardIds[i + j] }))
    sheets.push(slice)
  }

  // Cards captured so far, reported via onProgress as 1..cards.length.
  let done = 0
  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s]
    const count = sheet.length

    // Capture detail cards
    const detailImages: string[] = []
    for (const { card, id } of sheet) {
      // Try to get from DOM first (already rendered)
      const img = await captureDetailFromDom(String(id))
      if (!img) {

        const msg = `Problem with generating card: ${card.trackInfo.name} ${card.trackInfo.artist}`;
        alert(msg);
        throw new Error(msg);
      }
      detailImages.push(img)
      onProgress?.(++done, cards.length)
    }

    // Capture QR cards from DOM
    const qrImages: string[] = []
    for (const { id } of sheet) {
      const img = await captureQrFromDom(String(id))
      if (!img) throw new Error(`QR card not found in DOM for id ${id}`)
      qrImages.push(img)
    }

    const totalWidth = count * CARD_W_MM
    const startX = (PAGE_W - totalWidth) / 2
    const totalHeight = CARD_H_MM * 2
    const startY = (PAGE_H - totalHeight) / 2

    if (s > 0) doc.addPage()

    for (let i = 0; i < count; i++) {
      doc.addImage(detailImages[i], 'PNG', startX + i * CARD_W_MM, startY, CARD_W_MM, CARD_H_MM)
    }
    for (let i = 0; i < count; i++) {
      doc.addImage(qrImages[i], 'PNG', startX + i * CARD_W_MM, startY + CARD_H_MM, CARD_W_MM, CARD_H_MM)
    }
  }

  doc.save('music-cards.pdf')
}
