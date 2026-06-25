import type { CardData } from './types'

// Spotify track id for a card (the part after the last ':' in the URI).
export const trackIdOf = (card: CardData) => card.spotifyUri.split(':').pop() || ''
