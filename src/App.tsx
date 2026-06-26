import { useState, useRef, useEffect } from 'react'
import styled from 'styled-components'
import { fetchTrackInfo } from './spotify/spotify'
import type { CardData } from './common/types'
import { generatePdf } from './pdfGenerator'
import { SongList } from './components/SongList'
import { SheetPreview } from './components/SheetPreview'
import { ControlBar } from './components/ControlBar'
import { Button } from './common/shared.styles'
import { useAuth, sdk, getRedirectUri } from './auth/useAuth'
import { useAiDates } from './ai/useAiDates'
import { extractPlaylistId, fetchPlaylistTracks } from './spotify/spotify-user'

// ─── Constants ────────────────────────────────────────────────────────────────

// App-data localStorage key. Deliberately lives OUTSIDE the 'music-cards:' auth
// namespace: clearStoredAuth() (on logout, and on the expired/stale-token paths
// during mount) sweeps every key under that prefix, which would otherwise wipe
// this too.
const SONG_COUNTER_KEY = 'music-cards-app:songCounter'

// ─── Styled Components ────────────────────────────────────────────────────────

const AppWrapper = styled.div`
  display: flex;
  flex-direction: column;
  padding: 32px 40px;
  min-height: 100vh;
  background: #fafafa;
`

const TopPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 1000px;
`

const InputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const FieldLabel = styled.label`
  font-size: 0.85rem;
  color: #555;
  white-space: nowrap;
  width: 110px;
  flex-shrink: 0;
`

const Input = styled.input`
  font-size: 0.95rem;
  padding: 8px 12px;
  flex: 1;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  outline: none;

  &:focus {
    border-color: #888;
  }
`

const ErrorText = styled.div`
  color: #cc0000;
  font-size: 0.85rem;
  margin-top: 2px;
`

// ─── Confirm modal ───────────────────────────────────────────────────────────

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`

const ModalBox = styled.div`
  background: white;
  border-radius: 8px;
  padding: 24px;
  max-width: 360px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  text-align: center;
`

const ModalText = styled.p`
  font-size: 0.95rem;
  color: #333;
  margin: 0 0 20px;
  line-height: 1.45;
`

const ModalActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
`

// ─── Auth error ───────────────────────────────────────────────────────────────

const AuthError = styled.div`
  color: #cc0000;
  font-size: 0.82rem;
  white-space: pre-wrap;
  max-width: 680px;
`

// Wrapper that still receives hover events when the controls inside are
// disabled, so the "must be logged in" tooltip actually appears.
const DisabledHint = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTrackId(input: string): string {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/)
  if (urlMatch) return urlMatch[1]
  if (trimmed.includes(':')) return trimmed.split(':').pop() || trimmed
  return trimmed
}

// ─── App ──────────────────────────────────────────────────────────────────────

let nextId = 1

function App() {
  const [urlInput, setUrlInput] = useState('')
  const [playlistInput, setPlaylistInput] = useState('')
  const [playlistLoading, setPlaylistLoading] = useState(false)
  const [cards, setCards] = useState<CardData[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [songCounter, setSongCounter] = useState(() => {
    const stored = localStorage.getItem(SONG_COUNTER_KEY)
    const parsed = Number(stored)
    return stored && Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
  })
  const [pdfLoading, setPdfLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { auth, loggedIn, login, logout } = useAuth()
  const ai = useAiDates(cards, () => setError(null))

  useEffect(() => {
    localStorage.setItem(SONG_COUNTER_KEY, String(songCounter))
  }, [songCounter])

  const handleImportPlaylist = async () => {
    if (!loggedIn) return
    const raw = playlistInput.trim()
    if (!raw) return
    const playlistId = extractPlaylistId(raw)
    if (!playlistId) return

    setPlaylistLoading(true)
    setError(null)

    try {
      const tracks = await fetchPlaylistTracks(sdk, playlistId)
      const existing = new Set(cards.map(c => c.spotifyUri.split(':').pop() || ''))

      const newCards: CardData[] = []
      for (const t of tracks) {
        if (existing.has(t.trackId)) continue
        existing.add(t.trackId)
        newCards.push({
          id: nextId++,
          spotifyUri: `spotify:track:${t.trackId}`,
          spotifyYear: t.trackInfo.year,
          trackInfo: t.trackInfo,
        })
      }

      if (newCards.length === 0) {
        setError('No new songs to add (all tracks are already in the list).')
        return
      }

      setCards(prev => [...prev, ...newCards])
      setSelectedId(newCards[0].id)
      setSongCounter(prev => prev + newCards.length)
      setPlaylistInput('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import playlist')
    } finally {
      setPlaylistLoading(false)
    }
  }

  const handleAdd = async () => {
    const raw = urlInput.trim()
    if (!raw) return
    const trackId = extractTrackId(raw)
    if (!trackId) return

    const existing = new Set(cards.map(c => c.spotifyUri.split(':').pop() || ''))
    if (existing.has(trackId)) {
      setError('That song is already in the list.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const trackInfo = await fetchTrackInfo(trackId)
      const id = nextId++
      const newCard: CardData = { id, spotifyUri: `spotify:track:${trackId}`, spotifyYear: trackInfo.year, trackInfo }
      setCards(prev => [...prev, newCard])
      setSelectedId(id)
      setUrlInput('')
      setSongCounter(prev => prev + 1)
      inputRef.current?.focus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch track info')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (id: number) => {
    // If the deleted card is selected, move selection to the card after it
    // (or the one before, or nothing). Computed here from current state rather
    // than inside the setCards updater, which must stay side-effect free.
    if (selectedId === id) {
      const idx = cards.findIndex(c => c.id === id)
      const remaining = cards.filter(c => c.id !== id)
      const nextCard = remaining[idx] ?? remaining[idx - 1] ?? null
      setSelectedId(nextCard ? nextCard.id : null)
    }
    setCards(prev => prev.filter(c => c.id !== id))
    setSongCounter(prev => Math.max(1, prev - 1))
  }

  const updateCardField = (id: number, field: 'name' | 'artist' | 'year', value: string) => {
    setCards(prev => prev.map(c =>
      c.id === id
        ? { ...c, trackInfo: { ...c.trackInfo, [field]: value } }
        : c
    ))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAdd()
  }

  const handleGeneratePdf = async () => {
    if (cards.length === 0) return
    setPdfLoading(true)
    setError(null)
    try {
      await generatePdf(
        cards.map(c => ({ spotifyUri: c.spotifyUri, trackInfo: c.trackInfo })),
        cards.map(c => c.id)
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const handleClearSongs = () => {
    // Mirrors deleting every song one by one: the cards are removed but the
    // aiDates entries (keyed by track id) are kept, so re-adding a song — or
    // re-importing a playlist it's in — restores its previous AI year/cost.
    setCards([])
    setSelectedId(null)
    setError(null)
  }

  return (
    <AppWrapper className='app_wrapper'>
      {/* Top control bar: login status + Generate PDF + AI dates + counter + sheets + version */}
      <ControlBar
        auth={auth}
        onLogin={login}
        onLogout={logout}
        onGeneratePdf={handleGeneratePdf}
        pdfLoading={pdfLoading}
        onClearSongs={handleClearSongs}
        cardCount={cards.length}
        aiStatus={ai.aiStatus}
        hasUnqueried={ai.hasUnqueried}
        onDatesButton={ai.onDatesButton}
        webSearchEnabled={ai.webSearchEnabled}
        onToggleWebSearch={ai.onToggleWebSearch}
        totalCost={ai.totalCost}
        onCommitTotalCost={ai.onCommitTotalCost}
        songCounter={songCounter}
        onSongCounterChange={setSongCounter}
      />
      {auth.kind === 'out' && auth.error && <AuthError>{auth.error}</AuthError>}

      <TopPanel>
        {/* Redirect URI hint when logged out */}
        {auth.kind === 'out' && (
          <AuthError style={{ margin: 0, fontSize: '0.78rem', color: '#aaa' }}>
            Make sure{' '}
            <span style={{ fontFamily: 'monospace', color: '#888' }}>
              {getRedirectUri()}
            </span>{' '}
            is added in your{' '}
            <a
              href="https://developer.spotify.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0052cc' }}
            >
              Spotify Developer Dashboard
            </a>
          </AuthError>
        )}

        {/* Playlist import row */}
        <InputRow>
          <FieldLabel htmlFor="playlist-url">Export playlist</FieldLabel>
          <DisabledHint title={loggedIn ? '' : 'Must be logged in to use the playlist feature'}>
            <Input
              id="playlist-url"
              type="text"
              autoComplete="off"
              value={playlistInput}
              onChange={e => setPlaylistInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleImportPlaylist() }}
              placeholder="https://open.spotify.com/playlist/…"
              disabled={!loggedIn || playlistLoading}
            />
            <Button
              onClick={handleImportPlaylist}
              disabled={!loggedIn || playlistLoading || !playlistInput.trim()}
            >
              {playlistLoading ? 'Importing…' : 'Go'}
            </Button>
          </DisabledHint>
        </InputRow>

        {/* Add song row */}
        <InputRow>
          <FieldLabel htmlFor="song-url">Add song</FieldLabel>
          <Input
            id="song-url"
            ref={inputRef}
            type="text"
            autoComplete="off"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://open.spotify.com/track/…"
            disabled={loading}
          />
          <Button $primary onClick={handleAdd} disabled={loading || !urlInput.trim()}>
            {loading ? 'Loading…' : 'Add'}
          </Button>
        </InputRow>

        {error && <ErrorText>{error}</ErrorText>}

        {/* Song list */}
        <SongList
          cards={cards}
          selectedId={selectedId}
          aiDates={ai.aiDates}
          webSearchEnabled={ai.webSearchEnabled}
          webSearchingId={ai.webSearchingId}
          onSelect={setSelectedId}
          onApplyYear={(id, year) => updateCardField(id, 'year', year)}
          onWebSearch={ai.onWebSearch}
          onDelete={handleDelete}
        />
      </TopPanel>

      <SheetPreview
        cards={cards}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onFieldChange={updateCardField}
      />

      {ai.confirmWebSearch && (
        <ModalOverlay onClick={ai.closeWebSearchConfirm}>
          <ModalBox onClick={e => e.stopPropagation()}>
            <ModalText>
              Web search can be expensive (0.5 cent per query). Are you sure you
              want to enable it?
            </ModalText>
            <ModalActions>
              <Button $primary onClick={ai.confirmWebSearchYes}>
                Yes
              </Button>
              <Button onClick={ai.closeWebSearchConfirm}>No</Button>
            </ModalActions>
          </ModalBox>
        </ModalOverlay>
      )}
    </AppWrapper>
  )
}

export default App
