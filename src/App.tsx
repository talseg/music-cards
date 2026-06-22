import { useState, useRef, useEffect } from 'react'
import styled from 'styled-components'
import { QRCodeSVG } from 'qrcode.react'
import type { SpotifyApi } from '@spotify/web-api-ts-sdk'
import { version } from '../package.json'
import { fetchTrackInfo, type TrackInfo } from './spotify'
import { createAuth, type InitAuthResult } from './auth/spotify-auth'
import { fetchPlaylistTracks, extractPlaylistId } from './spotify-user'
import { generatePdf } from './pdfGenerator'
import { getSuggestedYear } from './perplexityDates'

// Create the auth bundle once at module load. The shared module (src/auth) is
// app-agnostic; everything app-specific about auth lives in this config.
// Only what the playlist-import feature needs. Deliberately omits the playback
// scopes the separate player app uses.
const auth_ = createAuth({
  clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID as string,
  scopes: ['playlist-read-private', 'playlist-read-collaborative'],
  cachePrefix: 'music-cards:',
})
const sdk: SpotifyApi = auth_.sdk

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

// Public, browser-readable flag (separate from the proxy-only secret key).
// The "Get AI dates" feature is fail-closed: hidden unless this is exactly
// 'true'. Anything else (absent / other value) leaves the feature off.
const DATES_ENABLED = import.meta.env.VITE_DATES_ENABLED === 'true'

// localStorage key for the lifetime running total of AI-query spend (USD).
const TOTAL_COST_KEY = 'music-cards:aiDatesTotalCost'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardData {
  id: number
  spotifyUri: string
  spotifyYear: string
  trackInfo: TrackInfo
}

// Transient AI-date result for one song, keyed by Spotify track id. Deliberately
// NOT part of CardData and NOT persisted (resets on reload). Entries are kept
// when a song is removed, so re-adding it restores its previous AI result rather
// than re-querying. `year` holds the parsed 4-digit year, or the literal 'Error'
// marker on a failed call.
interface AiDate {
  year: 'Error' | 'Unknown' | number
  cost: number
}

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

const VersionLabel = styled.div`
  font-size: 0.7rem;
  color: #aaa;
  margin-left: auto;
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
  width: 100%;
  max-width: 1000px;
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

const DISPLAY_LONG_LIST = true;
const LIST_HEIGHT = DISPLAY_LONG_LIST ? 650 : 192;

const ListScroll = styled.div`
  max-height: ${LIST_HEIGHT}px;
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

const ListItemYearSource = styled.span<{ $match: boolean | null; $clickable: boolean }>`
  font-size: 0.78rem;
  color: ${p => p.$match === null ? '#888' : p.$match ? '#2a6' : '#cc0000'};
  font-weight: ${p => p.$match === null ? 400 : 600};
  flex-shrink: 0;
  width: 44px;
  text-align: right;
  cursor: ${p => p.$clickable ? 'pointer' : 'default'};
`

const ListItemCard = styled.span`
  font-size: 0.78rem;
  color: #555;
  flex-shrink: 0;
  width: 44px;
  text-align: right;
`

const ListItemCost = styled.span`
  font-size: 0.72rem;
  color: #aaa;
  flex-shrink: 0;
  width: 48px;
  text-align: right;
`

// Header row above the song list. Column widths mirror the cells in each
// ListItem so labels sit over their values.
const ListHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 6px 12px;
  gap: 8px;
  background: #f7f7f7;
  border-bottom: 1px solid #e4e4e4;
  font-size: 0.68rem;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  user-select: none;
`

const HeadNum = styled.span`width: 22px; flex-shrink: 0; text-align: right;`
const HeadName = styled.span`flex: 1;`
const HeadArtist = styled.span`width: 160px; flex-shrink: 0;`
const HeadSpotify = styled.span`width: 44px; flex-shrink: 0; text-align: right;`
const HeadAi = styled.span`width: 26px; flex-shrink: 0; text-align: right;`
const HeadCard = styled.span`width: 54px; flex-shrink: 0; text-align: right;`
const HeadCost = styled.span`width: 56px; flex-shrink: 0; text-align: right;`
const HeadSearch = styled.span`width: 28px; flex-shrink: 0;`
const HeadCopy = styled.span`width: 22px; flex-shrink: 0;`
const HeadDelete = styled.span`width: 22px; flex-shrink: 0;`

const CopyBtn = styled.button`
  font-size: 0.75rem;
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
    background: #e8f4ff;
    border-color: #99c;
    color: #33c;
  }
`

const SearchBtn = styled.button`
  font-size: 0.7rem;
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

  &:hover:not(:disabled) {
    background: #e8f0ff;
    border-color: #99c;
    color: #33c;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
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

const SheetCounter = styled.div`
  font-size: 0.82rem;
  color: #888;
  white-space: nowrap;
  line-height: 1;
  padding-left: 120px;
`


const SongCounterValue = styled.input`
  width: 34px;
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

// ─── Add row ──────────────────────────────────────────────────────────────────

// ─── Card Preview ─────────────────────────────────────────────────────────────

const PreviewSection = styled.div`
  margin-top: 28px;
`

const SheetRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const ScrollBtn = styled.button`
  width: 32px;
  height: 32px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  color: #555;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  align-self: center;

  &:hover:not(:disabled) {
    background: #e8e8e8;
    border-color: #bbb;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }

  @media print {
    display: none;
  }
`

const CardGrid = styled.div`
  display: inline-flex;
  flex-direction: row;
  gap: 10px;

  @media print {
    gap: 0;
  }
`

const CardPairWrapper = styled.div<{ $selected: boolean; $clickable?: boolean }>`
  display: flex;
  flex-direction: column;
  outline: ${p => p.$selected ? '3px solid #1db954' : 'none'};
  outline-offset: 0px;
  border-radius: ${CARD_RADIUS_PX}px;
  cursor: ${p => p.$clickable ? 'pointer' : 'default'};

  @media print {
    outline: none;
  }
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

// Map the shared auth module's neutral result onto this app's AuthState model.
// (Error classification and the memoized exactly-once init live in
// src/auth/spotify-auth.ts; messages here are preserved from the previous
// in-file implementation.)
function toAuthState(result: InitAuthResult): AuthState {
  if (result.ok) {
    return { kind: 'in', user: result.user }
  }
  switch (result.kind) {
    case 'no-session':
      return { kind: 'out', error: null }
    case 'expired':
      // A stored token that no longer works: silently back to logged-out.
      return { kind: 'out', error: null }
    case 'stale-callback':
      // Transient PKCE verifier-not-found: partial state was cleared by the
      // shared module; user lands on a clean logged-out screen and can retry.
      return { kind: 'out', error: null }
    case 'redirect-uri':
      return {
        kind: 'out',
        error: `Login failed: redirect URI not registered.\nAdd ${result.redirectUri} at https://developer.spotify.com/dashboard`,
      }
    case 'error':
      return { kind: 'out', error: `Login failed: ${result.message}` }
  }
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
  const [songCounter, setSongCounter] = useState(() => {
    const stored = localStorage.getItem('music-cards:songCounter')
    const parsed = Number(stored)
    return stored && Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
  })
  const [pdfLoading, setPdfLoading] = useState(false)
  // AI release-year results, keyed by Spotify track id. Presence of an entry =
  // "already queried" (so the same song isn't queried twice). Entries persist
  // when songs are removed, so re-adding a song restores its previous result.
  const [aiDates, setAiDates] = useState<Map<string, AiDate>>(new Map())
  const [aiLoading, setAiLoading] = useState(false)
  const [webSearchingId, setWebSearchingId] = useState<string | null>(null)
  // Lifetime running total of AI-query spend (USD), persisted to localStorage so
  // it survives reloads. Editable by hand to sync across ports/machines.
  const [totalCost, setTotalCost] = useState(() => {
    const stored = localStorage.getItem(TOTAL_COST_KEY)
    const parsed = Number(stored)
    return stored && Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  })
  // Free-text mirror of totalCost while the field is focused, so typing (incl.
  // intermediate states like "0." ) isn't fought by the numeric state.
  const [totalCostInput, setTotalCostInput] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Maps each card id to its <ListItem> DOM node, so we can scroll the
  // selected song into view in the list whenever the selection changes.
  const listItemRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const selectedCard = cards.find(c => c.id === selectedId) ?? null
  const selectedIndex = selectedCard ? cards.findIndex(c => c.id === selectedId) : -1
  const selectedSheetIndex = selectedIndex >= 0 ? Math.ceil((selectedIndex + 1) / CARDS_PER_SHEET) : null
  const totalSheets = Math.ceil(cards.length / CARDS_PER_SHEET)

  // Cards on the sheet containing the selected card (always layout mode)
  const sheetCards: (CardData | null)[] = selectedSheetIndex !== null
    ? Array.from({ length: CARDS_PER_SHEET }, (_, i) => {
        const idx = (selectedSheetIndex - 1) * CARDS_PER_SHEET + i
        return cards[idx] ?? null
      })
    : []

  const loggedIn = auth.kind === 'in'

  useEffect(() => {
    localStorage.setItem('music-cards:songCounter', String(songCounter))
  }, [songCounter])

  useEffect(() => {
    localStorage.setItem(TOTAL_COST_KEY, String(totalCost))
  }, [totalCost])

  // Whenever the selected song changes, make sure its row is visible in the
  // list. Covers adding a song, clicking a preview card, and the sheet arrows.
  useEffect(() => {
    if (selectedId === null) return
    const node = listItemRefs.current.get(selectedId)
    node?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  // On mount: handle the OAuth callback, or silently validate a stored token.
  // The actual work is memoized inside the shared auth module (getInitAuth),
  // so it runs exactly once even though StrictMode invokes this effect twice
  // in dev. Both invocations await the same promise; whichever is still
  // mounted applies the result, so the UI always leaves the 'checking' state.
  useEffect(() => {
    let cancelled = false
    auth_.getInitAuth().then(result => {
      if (!cancelled) setAuth(toAuthState(result))
    })
    return () => { cancelled = true }
  }, [])

  const handleLogin = () => {
    sdk.authenticate().catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e)
      setAuth({ kind: 'out', error: `Login failed: ${message}` })
    })
  }

  const handleLogout = () => {
    auth_.clearStoredAuth()
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

  const handleScrollSheet = (direction: 'prev' | 'next') => {
    if (selectedSheetIndex === null) return
    const targetSheet = direction === 'next' ? selectedSheetIndex + 1 : selectedSheetIndex - 1
    const firstCardIdx = (targetSheet - 1) * CARDS_PER_SHEET
    const firstCard = cards[firstCardIdx]
    if (firstCard) setSelectedId(firstCard.id)
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

  const handleClearAll = () => {
    // Mirrors deleting every song one by one: the cards are removed but the
    // aiDates entries (keyed by track id) are kept, so re-adding a song — or
    // re-importing a playlist it's in — restores its previous AI year/cost.
    setCards([])
    setSelectedId(null)
    setError(null)
  }

  // Spotify track id for a card (the part after the last ':' in the URI).
  const trackIdOf = (card: CardData) => card.spotifyUri.split(':').pop() || ''

  // A song is "unqueried" iff it has no aiDates entry yet. The button is enabled
  // exactly when at least one song is unqueried.
  const hasUnqueried = DATES_ENABLED && cards.some(c => !aiDates.has(trackIdOf(c)))

  // Run the AI-dates pass over only the songs that haven't been queried yet.
  // Sequential (no added delay) so rows fill in live and we stay gentle on rate
  // limits. Each call's cost accumulates into the persisted lifetime total.
  const handleGetDates = async () => {
    if (aiLoading) return
    const pending = cards.filter(c => !aiDates.has(trackIdOf(c)))
    if (pending.length === 0) return

    setAiLoading(true)
    setError(null)
    try {
      for (const card of pending) {
        const id = trackIdOf(card)
        try {
          const { year, cost } = await getSuggestedYear(
            card.trackInfo.name,
            card.trackInfo.artist,
          )
          setAiDates(prev => {
            const next = new Map(prev)
            next.set(id, { year, cost })
            return next
          })
          if (cost > 0) setTotalCost(prev => prev + cost)
        } catch {
          // Network / HTTP failure: mark the row so it's visibly flagged and
          // won't be retried on the next press (a non-empty entry = queried).
          setAiDates(prev => {
            const next = new Map(prev)
            next.set(id, { year: 'Error', cost: 0 })
            return next
          })
        }
      }
    } finally {
      setAiLoading(false)
    }
  }

  const handleWebSearch = async (card: CardData) => {
    const id = trackIdOf(card)
    if (webSearchingId === id) return
    setWebSearchingId(id)
    try {
      const oldCost = aiDates.get(id)?.cost ?? 0
      const { year, cost } = await getSuggestedYear(
        card.trackInfo.name,
        card.trackInfo.artist,
        undefined,
        true,
      )
      setAiDates(prev => {
        const next = new Map(prev)
        next.set(id, { year, cost })
        return next
      })
      setTotalCost(prev => prev - oldCost + cost)
    } catch {
      setAiDates(prev => {
        const next = new Map(prev)
        next.set(id, { year: 'Error', cost: 0 })
        return next
      })
    } finally {
      setWebSearchingId(null)
    }
  }

  // ─── Card renderers ──────────────────────────────────────────────────────

  const renderFrontCard = (card: CardData, attrs?: Record<string, string>) => (
    <Card {...attrs}>
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
        <GameCardLabel>My Song Cards</GameCardLabel>
        <QRCodeSVG value={card.spotifyUri} size={120} />
      </QrCardContent>
    </Card>
  )

  const renderCardPair = (card: CardData, selected: boolean) => (
    <CardPairWrapper
      key={`pair-${card.id}`}
      $selected={selected}
      $clickable
      onClick={() => setSelectedId(card.id)}
    >
      {renderFrontCard(card, { 'data-pdf-detail': String(card.id) })}
      {renderBackCard(card, { 'data-pdf-qr': String(card.id) })}
    </CardPairWrapper>
  )

  // ─── Preview ─────────────────────────────────────────────────────────────

  const renderPreview = () => {
    if (!selectedCard) return null

    return (
      <CardGrid>
        {sheetCards.map((card, i) =>
          card
            ? renderCardPair(card, card.id === selectedId)
            : (
              <CardPairWrapper key={`ph-${i}`} $selected={false}>
                <CardPlaceholder />
                <CardPlaceholder />
              </CardPairWrapper>
            )
        )}
      </CardGrid>
    )
  }

  // Cards NOT currently shown in the preview need to be rendered hidden for PDF capture
  const visibleIds = new Set<number>()
  if (selectedCard) {
    sheetCards.forEach(c => c && visibleIds.add(c.id))
  }
  const hiddenCards = cards.filter(c => !visibleIds.has(c.id))

  const canScrollPrev = selectedSheetIndex !== null && selectedSheetIndex > 1
  const canScrollNext = selectedSheetIndex !== null && selectedSheetIndex < totalSheets

  return (
    <AppWrapper className='app_wrapper'>
      {/* Auth bar: login status + Generate PDF + counter + sheets + version */}
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
        <Button
          onClick={handleGeneratePdf}
          disabled={cards.length === 0 || pdfLoading}
        >
          {pdfLoading ? 'Generating…' : 'Generate PDF'}
        </Button>
        <Button
          onClick={handleClearAll}
          disabled={cards.length === 0}
          title="Remove all songs from the list"
        >
          Clear all
        </Button>
        <Button
          onClick={DATES_ENABLED ? handleGetDates : undefined}
          disabled={!DATES_ENABLED || !hasUnqueried || aiLoading}
          title={!DATES_ENABLED ? 'AI dates feature is disabled.\nAdd PERPLEXITY_API_KEY and set VITE_DATES_ENABLED=true in .env to enable.' : undefined}
        >
          {aiLoading ? 'Getting dates…' : 'Get AI dates'}
        </Button>
        {DATES_ENABLED && (
          <>
            <AuthStatus>Total $</AuthStatus>
            <input
              type="text"
              inputMode="decimal"
              value={totalCostInput ?? totalCost.toFixed(5)}
              onFocus={() => setTotalCostInput(String(totalCost))}
              onChange={e => setTotalCostInput(e.target.value)}
              onBlur={() => {
                const parsed = Number(totalCostInput)
                if (totalCostInput !== null && Number.isFinite(parsed) && parsed >= 0) {
                  setTotalCost(parsed)
                }
                setTotalCostInput(null)
              }}
              title="Lifetime AI-query spend (USD). Editable to sync across ports/machines."
              style={{ width: 78, fontSize: '0.85rem', border: '1px solid #ddd', borderRadius: 4, background: 'white', textAlign: 'right', padding: '4px 6px' }}
            />
          </>
        )}
        <CounterBtn onClick={() => setSongCounter(p => Math.max(1, p - 1))}>−</CounterBtn>
        <SongCounterValue
          type="number"
          value={songCounter}
          min={1}
          onChange={e => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v) && v >= 1) setSongCounter(v)
          }}
          style={{ width: 34, fontWeight: 700, fontSize: '0.95rem', border: '1px solid #ddd', borderRadius: 4, background: '#f0f0f0', textAlign: 'center', padding: '4px 0' }}
        />
        <CounterBtn onClick={() => setSongCounter(p => p + 1)}>+</CounterBtn>
        <SheetCounter style={{ paddingLeft: 0 }}>
          {cards.length > 0
            ? `${sheetCount(cards.length)} sheet${parseFloat(sheetCount(cards.length)) !== 1 ? 's' : ''}`
            : ''}
        </SheetCounter>
        <VersionLabel>music-cards v{version}</VersionLabel>
      </AuthBar>
      {auth.kind === 'out' && auth.error && <AuthError>{auth.error}</AuthError>}

      <TopPanel>
        {/* Redirect URI hint when logged out */}
        {auth.kind === 'out' && (
          <AuthError style={{ margin: 0, fontSize: '0.78rem', color: '#aaa' }}>
            Make sure{' '}
            <span style={{ fontFamily: 'monospace', color: '#888' }}>
              {auth_.getRedirectUri()}
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
        <ListPanel className='list_panel'>
          {DATES_ENABLED && cards.length > 0 && (
            <ListHeader>
              <HeadNum>#</HeadNum>
              <HeadName>Song</HeadName>
              <HeadArtist>Artist</HeadArtist>
              <HeadSpotify>Spotify</HeadSpotify>
              <HeadAi>AI</HeadAi>
              <HeadCard>Card</HeadCard>
              <HeadCost>cents</HeadCost>
              <HeadSearch />
              <HeadCopy />
              <HeadDelete />
            </ListHeader>
          )}
          <ListScroll className='list_scroll'>
            {cards.length === 0
              ? <ListEmpty>No songs yet — paste a Spotify URL above and press Add</ListEmpty>
              : cards.map((card, idx) => {
                const ai = DATES_ENABLED ? aiDates.get(trackIdOf(card)) : undefined
                const aiError = typeof ai?.year === 'string'
                const spotifyMatch = card.spotifyYear === card.trackInfo.year.trim()
                const aiMatch = !!ai && !aiError &&
                  String(ai.year) === card.trackInfo.year.trim()
                return (
                <ListItem
                  key={card.id}
                  ref={node => {
                    if (node) listItemRefs.current.set(card.id, node)
                    else listItemRefs.current.delete(card.id)
                  }}
                  $selected={card.id === selectedId}
                  onClick={() => setSelectedId(card.id)}
                >
                  <ListItemNum>{idx + 1}</ListItemNum>
                  <ListItemName>{card.trackInfo.name}</ListItemName>
                  <ListItemArtist>{card.trackInfo.artist}</ListItemArtist>
                  {DATES_ENABLED && (
                    <>
                      <ListItemYearSource
                        $match={spotifyMatch}
                        $clickable={!spotifyMatch}
                        onClick={!spotifyMatch ? (e) => {
                          e.stopPropagation()
                          updateCardField(card.id, 'year', card.spotifyYear)
                        } : undefined}
                      >
                        {card.spotifyYear}
                      </ListItemYearSource>
                      <ListItemYearSource
                        $match={ai ? aiMatch : null}
                        $clickable={!!ai && !aiError && !aiMatch}
                        onClick={ai && !aiError && !aiMatch ? (e) => {
                          e.stopPropagation()
                          updateCardField(card.id, 'year', String(ai.year))
                        } : undefined}
                      >
                        {ai ? ai.year : '----'}
                      </ListItemYearSource>
                      <ListItemCard>{card.trackInfo.year}</ListItemCard>
                      <ListItemCost>
                        {ai ? (ai.cost * 100).toFixed(3) : ''}
                      </ListItemCost>
                    </>
                  )}
                  {DATES_ENABLED && (
                    <SearchBtn
                      title="Web search for release year"
                      disabled={webSearchingId === trackIdOf(card)}
                      onClick={e => {
                        e.stopPropagation()
                        handleWebSearch(card)
                      }}
                    >
                      {webSearchingId === trackIdOf(card) ? '…' : '🔍'}
                    </SearchBtn>
                  )}
                  {!DATES_ENABLED && (
                    <ListItemYear>{card.trackInfo.year}</ListItemYear>
                  )}
                  <CopyBtn
                    title="Copy song name and artist"
                    onClick={e => {
                      e.stopPropagation()
                      navigator.clipboard.writeText(`${card.trackInfo.name} ${card.trackInfo.artist}`)
                    }}
                  >
                    ⧉
                  </CopyBtn>
                  <DeleteBtn
                    title="Remove"
                    onClick={e => { e.stopPropagation(); handleDelete(card.id) }}
                  >
                    −
                  </DeleteBtn>
                </ListItem>
                )
              })
            }
          </ListScroll>
        </ListPanel>
      </TopPanel>

      {/* Sheet preview with flanking scroll buttons */}
      {selectedCard && (
        <PreviewSection>
          <SheetRow>
            <ScrollBtn
              onClick={() => handleScrollSheet('prev')}
              disabled={!canScrollPrev}
              title="Previous sheet"
            >
              ‹
            </ScrollBtn>
            {renderPreview()}
            <ScrollBtn
              onClick={() => handleScrollSheet('next')}
              disabled={!canScrollNext}
              title="Next sheet"
            >
              ›
            </ScrollBtn>
          </SheetRow>
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
