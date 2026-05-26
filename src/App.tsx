import { useState } from 'react'
import styled from 'styled-components'
import { QRCodeSVG } from 'qrcode.react'
import { version } from '../package.json'
import { fetchTrackInfo, type TrackInfo } from './spotify'
import { generatePdf } from './pdfGenerator'

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

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const Label = styled.label`
  font-size: 1rem;
  white-space: nowrap;
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
  display: flex;
  gap: 24px;
  align-items: flex-start;
`

// Standard playing card: 63.5mm × 88.9mm
// At screen preview scale: ~2.5px per mm
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

const CardTitle = styled.div`
  font-size: 0.65rem;
  color: #999;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 1px;
`

const SongName = styled.div`
  font-size: 0.95rem;
  font-weight: 600;
  color: #1a1a2e;
  text-align: center;
  padding: 0 12px;
  margin-bottom: 6px;
  word-break: break-word;
`

const ArtistName = styled.div`
  font-size: 0.8rem;
  color: #16213e;
  text-align: center;
  padding: 0 12px;
  margin-bottom: 10px;
`

const YearText = styled.div`
  font-size: 0.75rem;
  color: #0f3460;
  font-weight: 500;
`

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
  const [songUrl, setSongUrl] = useState('')
  const [spotifyUri, setSpotifyUri] = useState<string | null>(null)
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!songUrl.trim()) {
      alert('Please enter a song URL')
      return
    }

    const trackId = extractTrackId(songUrl.trim())
    setSpotifyUri(`spotify:track:${trackId}`)
    setTrackInfo(null)
    setError(null)
    setLoading(true)

    try {
      const info = await fetchTrackInfo(trackId)
      setTrackInfo(info)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch track info')
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePdf = async () => {
    if (!spotifyUri || !trackInfo) return
    try {
      await generatePdf(spotifyUri, trackInfo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF')
    }
  }

  return (
    <AppWrapper>
      <VersionLabel>project version: {version}</VersionLabel>
      <Row>
        <Label htmlFor="song-url">Song URL</Label>
        <Input
          id="song-url"
          type="text"
          value={songUrl}
          onChange={(e) => setSongUrl(e.target.value)}
          placeholder="https://open.spotify.com/track/..."
        />
        <Button onClick={handleGenerate} disabled={loading}>
          {loading ? 'Loading...' : 'Generate'}
        </Button>
        <Button onClick={handleGeneratePdf} disabled={!spotifyUri || !trackInfo}>
          Generate PDF
        </Button>
      </Row>
      {error && <ErrorText>{error}</ErrorText>}
      {spotifyUri && (
        <CardsPreview>
          <Card className="qr-preview">
            <QRCodeSVG value={spotifyUri} size={120} />
          </Card>
          {trackInfo && (
            <Card>
              <CardTitle>♫</CardTitle>
              <SongName>{trackInfo.name}</SongName>
              <ArtistName>{trackInfo.artist}</ArtistName>
              <YearText>{trackInfo.year}</YearText>
            </Card>
          )}
        </CardsPreview>
      )}
    </AppWrapper>
  )
}

export default App
