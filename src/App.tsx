import { useState } from 'react'
import styled from 'styled-components'
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

function App() {
  const [songUrl, setSongUrl] = useState('')

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
      </Row>
    </AppWrapper>
  )
}

export default App
