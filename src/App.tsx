import { useState } from 'react'
import styled from 'styled-components'
import { QRCodeSVG } from 'qrcode.react'
import { version } from '../package.json'
import { fetchTrackInfo, type TrackInfo } from './spotify'

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

const ResultContainer = styled.div`
  margin-top: 24px;
  display: flex;
  gap: 32px;
  align-items: flex-start;
`

const TrackDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const DetailRow = styled.div`
  font-size: 1rem;
`

const DetailLabel = styled.span`
  font-weight: bold;
  margin-right: 8px;
`

const ErrorText = styled.div`
  margin-top: 16px;
  color: #cc0000;
  font-size: 0.9rem;
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
      </Row>
      {error && <ErrorText>{error}</ErrorText>}
      {spotifyUri && (
        <ResultContainer>
          <QRCodeSVG value={spotifyUri} size={256} />
          {trackInfo && (
            <TrackDetails>
              <DetailRow>
                <DetailLabel>Song:</DetailLabel>{trackInfo.name}
              </DetailRow>
              <DetailRow>
                <DetailLabel>Artist:</DetailLabel>{trackInfo.artist}
              </DetailRow>
              <DetailRow>
                <DetailLabel>Year:</DetailLabel>{trackInfo.year}
              </DetailRow>
            </TrackDetails>
          )}
        </ResultContainer>
      )}
    </AppWrapper>
  )
}

export default App
