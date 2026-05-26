import { useState } from 'react'
import styled from 'styled-components'
import { QRCodeSVG } from 'qrcode.react'
import { version } from '../package.json'
import { fetchTrackInfo, type TrackInfo } from './spotify'
import { generatePdf } from './pdfGenerator'

const NUM_SLOTS = 4

const AppWrapper = styled.div`
  display: flex;
  flex-direction: column;
  padding: 40px;
`

const VersionLabel = styled.div`
  font-size: 0.75rem;
  color: #888;
  margin-bottom: 32px;
`

const InputRows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const Label = styled.label`
  font-size: 1rem;
  white-space: nowrap;
  width: 90px;
`

const Input = styled.input`
  font-size: 1rem;
  padding: 8px 12px;
  width: 360px;
  border: 1px solid #ccc;
  border-radius: 4px;
`

const Button = styled.button`
  font-size: 1rem;
  padding: 8px 20px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f5f5f5;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: #e8e8e8;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`

const ErrorText = styled.div`
  margin-top: 16px;
  color: #cc0000;
  font-size: 0.9rem;
`

const CardsPreview = styled.div`
  margin-top: 32px;
  display: inline-flex;
  flex-direction: column;
`

const CardRow = styled.div`
  display: flex;
`

// Standard playing card: 63.5mm × 88.9mm
// Screen preview scale: ~2.5px per mm
const CARD_WIDTH_PX = 159
const CARD_HEIGHT_PX = 222
const CARD_RADIUS_PX = 8

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
`

const ArtistName = styled.div`
  font-size: 0.8rem;
  color: #002a9c;
  text-align: center;
  padding: 0 12px;
  margin-bottom: 10px;
`

const YearText = styled.div`
  font-size: 0.75rem;
  color: #0f3460;
  font-weight: 500;
`

interface CardData {
  spotifyUri: string
  trackInfo: TrackInfo
}

function extractTrackId(input: string): string {
  if (input.includes('/')) {
    return input.split('/').pop() || input
  }
  if (input.includes(':')) {
    return input.split(':').pop() || input
  }
  return input
}

function App() {
  const [urls, setUrls] = useState<string[]>(Array(NUM_SLOTS).fill(''))
  const [cards, setCards] = useState<CardData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasAnyInput = urls.some((u) => u.trim() !== '')
  const hasCards = cards.length > 0

  const updateUrl = (index: number, value: string) => {
    setUrls((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleGenerate = async () => {
    const filledUrls = urls
      .map((u, i) => ({ url: u.trim(), index: i }))
      .filter((item) => item.url !== '')

    if (filledUrls.length === 0) return

    setCards([])
    setError(null)
    setLoading(true)

    try {
      const results = await Promise.all(
        filledUrls.map(async (item) => {
          const trackId = extractTrackId(item.url)
          const trackInfo = await fetchTrackInfo(trackId)
          return {
            spotifyUri: `spotify:track:${trackId}`,
            trackInfo,
          }
        })
      )
      setCards(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch track info')
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePdf = async () => {
    if (!hasCards) return
    try {
      await generatePdf()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF')
    }
  }

  return (
    <AppWrapper>
      <VersionLabel>project version: {version}</VersionLabel>
      <InputRows>
        {urls.map((url, i) => (
          <Row key={i}>
            <Label htmlFor={`song-url-${i}`}>Song URL {i + 1}:</Label>
            <Input
              id={`song-url-${i}`}
              type="text"
              value={url}
              onChange={(e) => updateUrl(i, e.target.value)}
              placeholder="https://open.spotify.com/track/..."
            />
            {i === 0 && (
              <>
                <Button onClick={handleGenerate} disabled={loading || !hasAnyInput}>
                  {loading ? 'Loading...' : 'Generate'}
                </Button>
                <Button onClick={handleGeneratePdf} disabled={!hasCards}>
                  Generate PDF
                </Button>
              </>
            )}
          </Row>
        ))}
      </InputRows>
      {error && <ErrorText>{error}</ErrorText>}
      {hasCards && (
        <CardsPreview className="cards-preview">
          <CardRow className="cards-row-details">
            {cards.map((card, i) => (
              <Card key={`detail-${i}`}>
                <CardNote>♫</CardNote>
                <SongName>{card.trackInfo.name}</SongName>
                <ArtistName>{card.trackInfo.artist}</ArtistName>
                <YearText>{card.trackInfo.year}</YearText>
              </Card>
            ))}
          </CardRow>
          <CardRow className="cards-row-qr">
            {cards.map((card, i) => (
              <Card key={`qr-${i}`}>
                <QRCodeSVG value={card.spotifyUri} size={120} />
              </Card>
            ))}
          </CardRow>
        </CardsPreview>
      )}
    </AppWrapper>
  )
}

export default App
