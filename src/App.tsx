import { useState } from 'react'
import './App.css'

function App() {
  const [songUrl, setSongUrl] = useState('')

  return (
    <div className="app-container">
      <label htmlFor="song-url">Song URL</label>
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
