import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { TrackInfo } from './spotify'

// Standard playing card: 63.5mm × 88.9mm
const CARD_W_MM = 63.5
const CARD_H_MM = 88.9
const CARDS_PER_SHEET = 4
const CARD_WIDTH_PX = 159
const CARD_HEIGHT_PX = 222
const CARD_RADIUS_PX = 8

export interface CardInput {
  spotifyUri: string
  trackInfo: TrackInfo
}

// Build a QR code SVG data URL using the qrcode library via canvas approach
// We use a simple approach: render an inline SVG QR approximation
// Actually we'll use a hidden canvas element approach with qrcode-generator

function buildDetailCardHtml(card: CardInput): string {
  return `
    <div style="
      width:${CARD_WIDTH_PX}px;
      height:${CARD_HEIGHT_PX}px;
      border:1px solid #333;
      border-radius:${CARD_RADIUS_PX}px;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      background:white;
      overflow:hidden;
      box-sizing:border-box;
    ">
      <div style="font-size:2rem;color:#3fdf0a;margin-bottom:4px;">♫</div>
      <div style="font-size:0.95rem;font-weight:600;color:#cd0000;text-align:center;padding:0 12px;margin-bottom:6px;word-break:break-word;">
        ${escapeHtml(card.trackInfo.name)}
      </div>
      <div style="font-size:0.8rem;color:#002a9c;text-align:center;padding:0 12px;margin-bottom:10px;">
        ${escapeHtml(card.trackInfo.artist)}
      </div>
      <div style="font-size:0.75rem;color:#0f3460;font-weight:500;">
        ${escapeHtml(card.trackInfo.year)}
      </div>
    </div>
  `
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Capture a single card's image by creating a hidden DOM element
async function captureCardElement(html: string): Promise<string> {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:fixed;top:-9999px;left:-9999px;'
  wrapper.innerHTML = html
  document.body.appendChild(wrapper)
  const el = wrapper.firstElementChild as HTMLElement

  const canvas = await html2canvas(el, {
    scale: 4,
    backgroundColor: '#ffffff',
    logging: false,
  })
  const dataUrl = canvas.toDataURL('image/png')
  document.body.removeChild(wrapper)
  return dataUrl
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

export async function generatePdf(cards: CardInput[], cardIds: number[]): Promise<void> {
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

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s]
    const count = sheet.length

    // Capture detail cards
    const detailImages: string[] = []
    for (const { card, id } of sheet) {
      // Try to get from DOM first (already rendered)
      let img = await captureDetailFromDom(String(id))
      if (!img) {
        // Fall back to building it ourselves
        img = await captureCardElement(buildDetailCardHtml(card))
      }
      detailImages.push(img)
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
