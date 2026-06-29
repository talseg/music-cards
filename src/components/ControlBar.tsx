import styled from 'styled-components'
import { version } from '../../package.json'
import { sheetCount } from '../common/helpers'
import type { AuthState } from '../common/types'
import type { AiState } from '../ai/useAiDates'
import type { SongsInterface } from '../songs/useSongs'
import { Button, MutedLabel } from '../common/shared.styles'
import { AiControls } from './AiControls'

// ─── Control bar styled-components ──────────────────────────────────────────────

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
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

const SheetCounter = styled.div`
  font-size: 0.82rem;
  color: #888;
  white-space: nowrap;
  line-height: 1;
  padding-left: 120px;
`

const VersionLabel = styled.div`
  font-size: 0.7rem;
  color: #aaa;
  margin-left: auto;
`

// ─── ControlBar ─────────────────────────────────────────────────────────────────

interface ControlBarProps {
  auth: AuthState
  onLogin: () => void
  onLogout: () => void
  songs: SongsInterface
  // Undefined when the AI-dates feature is disabled; its presence is what marks
  // the feature active (see useAiDates).
  ai?: AiState
}

// The app's top control bar: auth status/login + Generate PDF + AI glass (date
// the selection) + Pause/Resume + web-search toggle / Total-$ + song counter +
// sheet count + version.
export function ControlBar({
  auth,
  onLogin,
  onLogout,
  songs,
  ai,
}: ControlBarProps) {
  const {
    cards,
    selectedIds,
    songCounter,
    setSongCounter: onSongCounterChange,
    pdfLoading,
    pdfProgress,
    handleGeneratePdf: onGeneratePdf,
  } = songs
  const cardCount = cards.length
  // The songs the AI glass acts on. Computed here (not stored) so it always
  // matches the current selection and card list.
  const selectedCards = cards.filter(c => selectedIds.has(c.id))

  return (
    <Bar>
      {auth.kind === 'checking' && <MutedLabel>Checking login…</MutedLabel>}
      {auth.kind === 'out' && (
        <SpotifyButton onClick={onLogin}>Log in with Spotify</SpotifyButton>
      )}
      {auth.kind === 'in' && (
        <>
          <MutedLabel>Logged in as: {auth.user}</MutedLabel>
          <LogoutLink onClick={onLogout}>Log out</LogoutLink>
        </>
      )}
      <Button
        onClick={onGeneratePdf}
        disabled={cardCount === 0 || pdfLoading}
      >
        {pdfLoading
          ? (pdfProgress ? `Generating… ${pdfProgress.done}/${pdfProgress.total}` : 'Generating…')
          : 'Generate PDF'}
      </Button>
      {ai && <AiControls ai={ai} selectedCards={selectedCards} />}
      <CounterBtn onClick={() => onSongCounterChange(Math.max(1, songCounter - 1))}>−</CounterBtn>
      <SongCounterValue
        type="number"
        value={songCounter}
        min={1}
        onChange={e => {
          const v = parseInt(e.target.value, 10)
          if (!isNaN(v) && v >= 1) onSongCounterChange(v)
        }}
        style={{ width: 34, fontWeight: 700, fontSize: '0.95rem', border: '1px solid #ddd', borderRadius: 4, background: '#f0f0f0', textAlign: 'center', padding: '4px 0' }}
      />
      <CounterBtn onClick={() => onSongCounterChange(songCounter + 1)}>+</CounterBtn>
      <SheetCounter style={{ paddingLeft: 0 }}>
        {cardCount > 0
          ? `${sheetCount(cardCount)} sheet${parseFloat(sheetCount(cardCount)) !== 1 ? 's' : ''}`
          : ''}
      </SheetCounter>
      <VersionLabel>music-cards v{version}</VersionLabel>
    </Bar>
  )
}
