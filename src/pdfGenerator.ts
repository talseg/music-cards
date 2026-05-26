import jsPDF from 'jspdf'
import type { TrackInfo } from './spotify'

// Standard playing card: 63.5mm × 88.9mm
const CARD_W = 63.5
const CARD_H = 88.9
const CARD_R = 3 // corner radius in mm

// A4 page: 210 × 297mm
const PAGE_W = 210
const PAGE_H = 297

// Center the pair horizontally with a gap
const GAP = 12
const PAIR_W = CARD_W * 2 + GAP
const START_X = (PAGE_W - PAIR_W) / 2
const START_Y = (PAGE_H - CARD_H) / 2

function drawRoundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number) {
  doc.roundedRect(x, y, w, h, r, r, 'S')
}

function renderQrToCanvas(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Find the QR SVG already rendered in the DOM
    const svgEl = document.querySelector('.qr-preview svg') as SVGElement | null
    if (!svgEl) {
      reject(new Error('QR code SVG not found in DOM'))
      return
    }

    const svgData = new XMLSerializer().serializeToString(svgEl)
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 400
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, 400, 400)
      ctx.drawImage(img, 0, 0, 400, 400)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load QR SVG as image'))
    }
    img.src = url
  })
}

export async function generatePdf(_spotifyUri: string, trackInfo: TrackInfo): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // --- Front card (QR side) ---
  const frontX = START_X
  const frontY = START_Y

  doc.setDrawColor(51, 51, 51)
  doc.setLineWidth(0.3)
  drawRoundedRect(doc, frontX, frontY, CARD_W, CARD_H, CARD_R)

  // Render QR from DOM SVG
  const qrPng = await renderQrToCanvas()
  const qrMm = 45
  const qrX = frontX + (CARD_W - qrMm) / 2
  const qrY = frontY + (CARD_H - qrMm) / 2
  doc.addImage(qrPng, 'PNG', qrX, qrY, qrMm, qrMm)

  // --- Back card (details side) ---
  const backX = START_X + CARD_W + GAP
  const backY = START_Y

  doc.setDrawColor(51, 51, 51)
  doc.setLineWidth(0.3)
  drawRoundedRect(doc, backX, backY, CARD_W, CARD_H, CARD_R)

  const centerX = backX + CARD_W / 2

  // Music note at top
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(180, 180, 180)
  doc.text('\u266B', centerX, backY + 18, { align: 'center' })

  // Song name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(26, 26, 46)
  const songLines: string[] = doc.splitTextToSize(trackInfo.name, CARD_W - 16)
  const textStartY = backY + 32
  doc.text(songLines, centerX, textStartY, { align: 'center' })

  // Artist name
  const artistY = textStartY + songLines.length * 5 + 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(22, 33, 62)
  const artistLines: string[] = doc.splitTextToSize(trackInfo.artist, CARD_W - 16)
  doc.text(artistLines, centerX, artistY, { align: 'center' })

  // Year
  const yearY = artistY + artistLines.length * 4 + 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(15, 52, 96)
  doc.text(trackInfo.year, centerX, yearY, { align: 'center' })

  doc.save('music-card.pdf')
}
