import type { CardData } from './types'
import { CARDS_PER_SHEET } from './constants'

// Spotify track id for a card (the part after the last ':' in the URI).
export const trackIdOf = (card: CardData) => card.spotifyUri.split(':').pop() || ''

// Number of printed sheets for a given card count, rounded up to the nearest
// quarter-sheet and rendered without trailing zeros (e.g. '1', '1.25', '2.5').
export function sheetCount(cardCount: number): string {
  if (cardCount === 0) return '0'
  const sheets = cardCount / CARDS_PER_SHEET
  const nearest = Math.ceil(sheets * 4) / 4
  if (Number.isInteger(nearest)) return String(nearest)
  const str = nearest.toFixed(2)
  return str.replace(/\.?0+$/, '')
}
