import { useState } from 'react'
import styled from 'styled-components'
import { QRCodeSVG } from 'qrcode.react'
import { version } from '../package.json'

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
`

const QRContainer = styled.div`
  margin-top: 24px;
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

  const handleGenerate = () => {
    if (!songUrl.trim()) {
      alert('Please enter a song URL')
      return
    }

    const trackId = extractTrackId(songUrl.trim())
    setSpotifyUri(`spotify:track:${trackId}`)
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
        <Button onClick={handleGenerate}>Generate</Button>
      </Row>
      {spotifyUri && (
        <QRContainer>
          <QRCodeSVG value={spotifyUri} size={256} />
        </QRContainer>
      )}
    </AppWrapper>
  )
}

export default App
