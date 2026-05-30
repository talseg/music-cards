import { useState, useRef, useEffect } from 'react'
import styled from 'styled-components'
import { QRCodeSVG } from 'qrcode.react'
import type { SpotifyApi } from '@spotify/web-api-ts-sdk'
import { version } from '../package.json'
import { fetchTrackInfo, type TrackInfo } from './spotify'
import {
  createSpotifyApi,
  clearStoredAuth,
  hasStoredToken,
  getRedirectUriForDisplay,
} from './spotify-auth'
import { fetchPlaylistTracks, extractPlaylistId } from './spotify-user'
import { generatePdf } from './pdfGenerator'

// Create the SDK once at module load (mirrors the player app's pattern).
const sdk: SpotifyApi = createSpotifyApi()

// Auth phase for the (non-blocking) login feature.
//   'checking' - verifying a stored token / handling the OAuth callback on mount
//   'out'      - not logged in; regular mode (login optional)
//   'in'       - logged in and profile confirmed; playlist feature enabled
type AuthState =
  | { kind: 'checking' }
  | { kind: 'out'; error: string | null }
  | { kind: 'in'; user: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const CARDS_PER_SHEET = 4
const CARD_WIDTH_PX = 159
const CARD_HEIGHT_PX = 222
const CARD_RADIUS_PX = 8

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardData {
  id: number
  spotifyUri: string
  trackInfo: TrackInfo
}

// ─── Styled Components ────────────────────────────────────────────────────────

const AppWrapper = styled.div`
  display: flex;
  flex-direction: column;
  padding: 32px 40px;
  min-height: 100vh;
  background: #fafafa;
`

const VersionLabel = styled.div`
  font-size: 0.7rem;
  color: #aaa;
  margin-bottom: 24px;
`

const TopPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 680px;
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

const Button = styled.button<{ $primary?: boolean }>`
  font-size: 0.95rem;
  padding: 8px 18px;
  border: 1px solid ${p => p.$primary ? '#2a6' : '#ccc'};
  border-radius: 4px;
  background: ${p => p.$primary ? '#2a6' : '#f5f5f5'};
  color: ${p => p.$primary ? 'white' : '#333'};
  cursor: pointer;
  white-space: nowrap;
  font-weight: ${p => p.$primary ? 600 : 400};

  &:hover {
    background: ${p => p.$primary ? '#298' : '#e8e8e8'};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

const ErrorText = styled.div`
  color: #cc0000;
  font-size: 0.85rem;
  margin-top: 2px;
`

// ─── Auth bar ───────────────────────────────────────────────────────────────

const AuthBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`

const SpotifyButton = styled.button`
  font-size: 0.9rem;
  padding: 8px 20px;
  border: none;
  border-radius: 20px;
  background: #1db954;
  color: white;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: #17a349;
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`

const AuthStatus = styled.span`
  font-size: 0.85rem;
  color: #555;
`

const LogoutLink = styled.button`
  font-size: 0.8rem;
  color: #0052cc;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;

  &:hover {
    color: #003a99;
  }
`

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

// ─── Song List ────────────────────────────────────────────────────────────────

const ListPanel = styled.div`
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
`

const ListScroll = styled.div`
  max-height: 240px;
  overflow-y: auto;
  background: white;
`

const ListEmpty = styled.div`
  padding: 20px 16px;
  font-size: 0.85rem;
  color: #aaa;
  text-align: center;
`

const ListItem = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  background: ${p => p.$selected ? '#e8f4ff' : 'white'};
  font-weight: ${p => p.$selected ? 700 : 400};
  color: ${p => p.$selected ? '#0052cc' : '#333'};
  gap: 8px;
  user-select: none;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${p => p.$selected ? '#d4ecff' : '#f7f7f7'};
  }
`

const ListItemNum = styled.span`
  font-size: 0.75rem;
  color: #aaa;
  width: 22px;
  flex-shrink: 0;
  text-align: right;
`

const ListItemName = styled.span`
  flex: 1;
  font-size: 0.88rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const ListItemArtist = styled.span`
  font-size: 0.8rem;
  color: #777;
  flex-shrink: 0;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const ListItemYear = styled.span`
  font-size: 0.78rem;
  color: #aaa;
  flex-shrink: 0;
  width: 36px;
  text-align: right;
`

const DeleteBtn = styled.button`
  font-size: 1rem;
  width: 22px;
  height: 22px;
  border: 1px solid #ddd;
  border-radius: 3px;
  background: white;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;

  &:hover {
    background: #fee;
    border-color: #f99;
    color: #c33;
  }
`

// ─── Bottom Controls ──────────────────────────────────────────────────────────

const BottomControls = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
`

const SheetCounter = styled.div`
  font-size: 0.82rem;
  color: #888;
  white-space: nowrap;
`

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: #555;
  cursor: pointer;
  user-select: none;

  input[type=checkbox] {
    cursor: pointer;
  }
`

const SongCounter = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 4px 8px;
`

const SongCounterLabel = styled.span`
  font-size: 0.78rem;
  color: #888;
  white-space: nowrap;
`

const SongCounterValue = styled.input`
  width: 44px;
  font-size: 0.95rem;
  font-weight: 700;
  color: #333;
  border: none;
  background: transparent;
  text-align: center;
  outline: none;
  padding: 0;

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
  }
`

const CounterBtn = styled.button`
  width: 22px;
  height: 22px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: white;
  color: #555;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;

  &:hover {
    background: #e8e8e8;
  }
`

// ─── Card Preview ─────────────────────────────────────────────────────────────

const PreviewSection = styled.div`
  margin-top: 28px;
`

const PreviewTitle = styled.div`
  font-size: 0.75rem;
  color: #aaa;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`

const CardGrid = styled.div`
  display: inline-flex;
  flex-direction: column;
`

const CardRow = styled.div`
  display: flex;
`

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

const CardPlaceholder = styled(Card)`
  border: 1px dashed #ccc;
  background: #fafafa;
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
  cursor: text;
  outline: none;
  min-width: 20px;

  &:hover { outline: 1px dashed #ccc; }
  &:focus { outline: 1px dashed #999; }
`

const ArtistName = styled.div`
  font-size: 0.8rem;
  color: #002a9c;
  text-align: center;
  padding: 0 12px;
  margin-bottom: 10px;
  cursor: text;
  outline: none;
  min-width: 20px;

  &:hover { outline: 1px dashed #ccc; }
  &:focus { outline: 1px dashed #999; }
`

const YearText = styled.div`
  font-size: 0.75rem;
  color: #0f3460;
  font-weight: 500;
  cursor: text;
  outline: none;
  min-width: 20px;

  &:hover { outline: 1px dashed #ccc; }
  &:focus { outline: 1px dashed #999; }
`

const QrCardContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: rotate(180deg);
  width: 100%;
  height: 100%;
  gap: 12px;
`

const GameCardLabel = styled.div`
  font-size: 0.75rem;
  color: #3fdf0a;
  font-weight: 500;
  letter-spacing: 1px;
`

// Hidden container: renders all cards off-screen for PDF capture
const HiddenCards = styled.div`
  position: fixed;
  top: -9999px;
  left: -9999px;
  display: flex;
  flex-direction: column;
  pointer-events: none;
`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTrackId(input: string): string {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/)
  if (urlMatch) return urlMatch[1]
  if (trimmed.includes(':')) return trimmed.split(':').pop() || trimmed
  return trimmed
}

function isRedirectUriError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('redirect') && m.includes('uri')
}

function sheetCount(cardCount: number): string {
  if (cardCount === 0) return '0'
  const sheets = cardCount / CARDS_PER_SHEET
  const nearest = Math.ceil(sheets * 4) / 4
  if (Number.isInteger(nearest)) return String(nearest)
  const str = nearest.toFixed(2)
  return str.replace(/\.?0+$/, '')
}

// ─── App ──────────────────────────────────────────────────────────────────────

let nextId = 1

function App() {
  const [urlInput, setUrlInput] = useState('')
  const [playlistInput, setPlaylistInput] = useState('')
  const [playlistLoading, setPlaylistLoading] = useState(false)
  const [auth, setAuth] = useState<AuthState>({ kind: 'checking' })
  const [cards, setCards] = useState<CardData[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [displayLayout, setDisplayLayout] = useState(false)
  const [songCounter, setSongCounter] = useState(1)
  const [pdfLoading, setPdfLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedCard = cards.find(c => c.id === selectedId) ?? null
  const selectedIndex = selectedCard ? cards.findIndex(c => c.id === selectedId) : -1
  const selectedSheetIndex = selectedIndex >= 0 ? Math.ceil((selectedIndex + 1) / CARDS_PER_SHEET) : null

  // Cards on the sheet containing the selected card
  const sheetCards: (CardData | null)[] = selectedSheetIndex !== null
    ? Array.from({ length: CARDS_PER_SHEET }, (_, i) => {
        const idx = (selectedSheetIndex - 1) * CARDS_PER_SHEET + i
        return cards[idx] ?? null
      })
    : []

  const loggedIn = auth.kind === 'in'

  // On mount: handle the OAuth callback, or silently validate a stored token.
  // Non-blocking: regular mode is usable throughout; this only sets logged-in
  // state when a token is confirmed by a successful profile fetch.
  useEffect(() => {
    let cancelled = false

    async function initAuth() {
      const isCallback = window.location.search.includes('code=')
      const hadToken = hasStoredToken()

      // Nothing to do: no callback and no stored token => regular mode.
      if (!isCallback && !hadToken) {
        if (!cancelled) setAuth({ kind: 'out', error: null })
        return
      }

      try {
        // Triggers the SDK's verify-and-exchange on callback, or uses/refreshes
        // the stored token otherwise. Profile fetch confirms the token is valid
        // AND has usable scope.
        const profile = await sdk.currentUser.profile()
        if (cancelled) return

        if (isCallback) {
          // Clean the ?code=... out of the URL.
          window.history.replaceState({}, '', window.location.pathname)
        }
        setAuth({ kind: 'in', user: profile.display_name || profile.email || 'Spotify user' })
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : String(e)

        // Known SDK quirk: on the very first callback render the PKCE verifier
        // may not be found; a re-run succeeds. If we're on the callback and it
        // failed, fall back to 'out' (no lockout) and let the user retry.
        if (isRedirectUriError(message)) {
          const uri = getRedirectUriForDisplay()
          setAuth({
            kind: 'out',
            error: `Login failed: redirect URI not registered.\nAdd ${uri} at https://developer.spotify.com/dashboard`,
          })
          return
        }

        // A stale stored token (expired/wrong scope) => clear it, back to out.
        if (hadToken && !isCallback) {
          clearStoredAuth()
          setAuth({ kind: 'out', error: null })
          return
        }

        setAuth({ kind: 'out', error: `Login failed: ${message}` })
      }
    }

    initAuth()
    return () => {
      cancelled = true
    }
  }, [])

  const handleLogin = () => {
    // Begins the redirect to Spotify. On return, the mount effect handles it.
    sdk.authenticate().catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e)
      setAuth({ kind: 'out', error: `Login failed: ${message}` })
    })
  }

  const handleLogout = () => {
    clearStoredAuth()
    setAuth({ kind: 'out', error: null })
  }

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

      // Dedupe by Spotify track ID (derived from each card's spotifyUri).
      const existing = new Set(cards.map(c => c.spotifyUri.split(':').pop() || ''))

      const newCards: CardData[] = []
      for (const t of tracks) {
        if (existing.has(t.trackId)) continue
        existing.add(t.trackId)
        newCards.push({
          id: nextId++,
          spotifyUri: `spotify:track:${t.trackId}`,
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

    // Reject duplicates (compare by Spotify track ID derived from spotifyUri).
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
      const newCard: CardData = { id, spotifyUri: `spotify:track:${trackId}`, trackInfo }
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
    setCards(prev => prev.filter(c => c.id !== id))
    setSongCounter(prev => Math.max(1, prev - 1))
    if (selectedId === id) setSelectedId(null)
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

  // ─── Card renderers ──────────────────────────────────────────────────────

  const renderFrontCard = (card: CardData, attrs?: Record<string, string>) => (
    <Card key={`detail-${card.id}`} {...attrs}>
      <CardNote>♫</CardNote>
      <SongName
        contentEditable
        suppressContentEditableWarning
        onBlur={e => updateCardField(card.id, 'name', e.currentTarget.textContent ?? '')}
      >{card.trackInfo.name}</SongName>
      <ArtistName
        contentEditable
        suppressContentEditableWarning
        onBlur={e => updateCardField(card.id, 'artist', e.currentTarget.textContent ?? '')}
      >{card.trackInfo.artist}</ArtistName>
      <YearText
        contentEditable
        suppressContentEditableWarning
        onBlur={e => updateCardField(card.id, 'year', e.currentTarget.textContent ?? '')}
      >{card.trackInfo.year}</YearText>
    </Card>
  )

  const renderBackCard = (card: CardData, attrs?: Record<string, string>) => (
    <Card key={`qr-${card.id}`} {...attrs}>
      <QrCardContent>
        <GameCardLabel>My Song ©</GameCardLabel>
        <QRCodeSVG value={card.spotifyUri} size={120} />
      </QrCardContent>
    </Card>
  )

  // ─── Preview ─────────────────────────────────────────────────────────────

  const renderPreview = () => {
    if (!selectedCard) return null

    if (displayLayout) {
      // Full sheet layout with placeholders
      return (
        <CardGrid>
          <CardRow>
            {sheetCards.map((card, i) =>
              card
                ? renderFrontCard(card, { 'data-pdf-detail': String(card.id) })
                : <CardPlaceholder key={`ph-f-${i}`} />
            )}
          </CardRow>
          <CardRow>
            {sheetCards.map((card, i) =>
              card
                ? renderBackCard(card, { 'data-pdf-qr': String(card.id) })
                : <CardPlaceholder key={`ph-b-${i}`} />
            )}
          </CardRow>
        </CardGrid>
      )
    }

    // Single card preview
    return (
      <CardGrid>
        <CardRow>
          {renderFrontCard(selectedCard, { 'data-pdf-detail': String(selectedCard.id) })}
        </CardRow>
        <CardRow>
          {renderBackCard(selectedCard, { 'data-pdf-qr': String(selectedCard.id) })}
        </CardRow>
      </CardGrid>
    )
  }

  // Cards NOT currently shown in the preview need to be rendered hidden for PDF capture
  const visibleIds = new Set<number>()
  if (selectedCard) {
    if (displayLayout) {
      sheetCards.forEach(c => c && visibleIds.add(c.id))
    } else {
      visibleIds.add(selectedCard.id)
    }
  }
  const hiddenCards = cards.filter(c => !visibleIds.has(c.id))

  return (
    <AppWrapper>
      <VersionLabel>music-cards v{version}</VersionLabel>

      {/* Auth bar (non-blocking; login is optional) */}
      <AuthBar>
        {auth.kind === 'checking' && <AuthStatus>Checking login…</AuthStatus>}
        {auth.kind === 'out' && (
          <SpotifyButton onClick={handleLogin}>Log in with Spotify</SpotifyButton>
        )}
        {auth.kind === 'in' && (
          <>
            <AuthStatus>Logged in as: {auth.user}</AuthStatus>
            <LogoutLink onClick={handleLogout}>Log out</LogoutLink>
          </>
        )}
      </AuthBar>
      {auth.kind === 'out' && auth.error && <AuthError>{auth.error}</AuthError>}

      <TopPanel>
        {/* Playlist import row (enabled only when logged in) */}
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

        {/* Single song URL input row */}
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
            {loading ? 'Loading…' : '+ Add'}
          </Button>
        </InputRow>

        {error && <ErrorText>{error}</ErrorText>}

        {/* Song list */}
        <ListPanel>
          <ListScroll>
            {cards.length === 0
              ? <ListEmpty>No songs yet — paste a Spotify URL above and press Add</ListEmpty>
              : cards.map((card, idx) => (
                <ListItem
                  key={card.id}
                  $selected={card.id === selectedId}
                  onClick={() => setSelectedId(card.id)}
                >
                  <ListItemNum>{idx + 1}</ListItemNum>
                  <ListItemName>{card.trackInfo.name}</ListItemName>
                  <ListItemArtist>{card.trackInfo.artist}</ListItemArtist>
                  <ListItemYear>{card.trackInfo.year}</ListItemYear>
                  <DeleteBtn
                    title="Remove"
                    onClick={e => { e.stopPropagation(); handleDelete(card.id) }}
                  >
                    −
                  </DeleteBtn>
                </ListItem>
              ))
            }
          </ListScroll>
        </ListPanel>

        {/* Controls row */}
        <BottomControls>
          <Button
            onClick={handleGeneratePdf}
            disabled={cards.length === 0 || pdfLoading}
          >
            {pdfLoading ? 'Generating…' : 'Generate PDF'}
          </Button>

          <SheetCounter>
            {cards.length > 0
              ? `${sheetCount(cards.length)} sheet${parseFloat(sheetCount(cards.length)) !== 1 ? 's' : ''}`
              : '—'}
          </SheetCounter>

          <CheckboxLabel>
            <input
              type="checkbox"
              checked={displayLayout}
              onChange={e => setDisplayLayout(e.target.checked)}
              disabled={!selectedCard}
            />
            Display Layout
          </CheckboxLabel>

          <SongCounter>
            <SongCounterLabel>Song #</SongCounterLabel>
            <CounterBtn onClick={() => setSongCounter(p => Math.max(1, p - 1))}>−</CounterBtn>
            <SongCounterValue
              type="number"
              value={songCounter}
              min={1}
              onChange={e => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && v >= 1) setSongCounter(v)
              }}
            />
            <CounterBtn onClick={() => setSongCounter(p => p + 1)}>+</CounterBtn>
          </SongCounter>
        </BottomControls>
      </TopPanel>

      {/* Visible preview */}
      {selectedCard && (
        <PreviewSection>
          <PreviewTitle>
            {displayLayout
              ? `Sheet ${selectedSheetIndex} layout`
              : `Preview — ${selectedCard.trackInfo.name}`}
          </PreviewTitle>
          {renderPreview()}
        </PreviewSection>
      )}

      {/* Hidden cards rendered off-screen for PDF capture */}
      <HiddenCards aria-hidden="true">
        {hiddenCards.map(card => (
          <div key={card.id}>
            {renderFrontCard(card, { 'data-pdf-detail': String(card.id) })}
            {renderBackCard(card, { 'data-pdf-qr': String(card.id) })}
          </div>
        ))}
      </HiddenCards>
    </AppWrapper>
  )
}

export default App
