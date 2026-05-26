import { useState } from 'react'
import { styled } from "styled-components";
import './App.css'


const URLStyled = styled.div`
  font-size: 16px;
`;



function App() {
  const [songUrl, setSongUrl] = useState('')

  return (
    <div className="app-container">
      <URLStyled>Song URL:</URLStyled>
      <input
        id="song-url"
        type="text"
        value={songUrl}
        onChange={(e) => setSongUrl(e.target.value)}
        placeholder="https://open.spotify.com/track/..."
      />
    </div>
  )
}

export default App
