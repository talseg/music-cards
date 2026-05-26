import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

// Standard playing card: 63.5mm × 88.9mm
const CARD_W_MM = 63.5
const CARD_H_MM = 88.9
const GAP_MM = 12
const PAIR_W = CARD_W_MM * 2 + GAP_MM
const START_X = (210 - PAIR_W) / 2
const START_Y = (297 - CARD_H_MM) / 2

async function cardToImage(element: HTMLElement): Promise<string> {
  const canvas = await html2canvas(element, {
    scale: 4,
    backgroundColor: '#ffffff',
    logging: false,
  })
  return canvas.toDataURL('image/png')
}

export async function generatePdf(): Promise<void> {
  const cards = document.querySelectorAll<HTMLElement>('.cards-preview > *')
  if (cards.length < 2) {
    throw new Error('Cards not found in preview')
  }

  const [frontPng, backPng] = await Promise.all([
    cardToImage(cards[0]),
    cardToImage(cards[1]),
  ])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  doc.addImage(frontPng, 'PNG', START_X, START_Y, CARD_W_MM, CARD_H_MM)
  doc.addImage(backPng, 'PNG', START_X + CARD_W_MM + GAP_MM, START_Y, CARD_W_MM, CARD_H_MM)
  doc.save('music-card.pdf')
}
