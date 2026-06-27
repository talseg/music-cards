import { useState } from 'react'
import styled from 'styled-components'
import { version } from '../../package.json'
import { sheetCount } from '../common/helpers'
import type { AuthState } from '../common/types'
import type { AiState } from '../ai/useAiDates'
import type { SongsInterface } from '../songs/useSongs'
import { Button } from '../common/shared.styles'

// ─── Control bar styled-components ──────────────────────────────────────────────

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
`

const AuthStatus = styled.span`
  font-size: 0.85rem;
  color: #555;
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

const ToggleLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #555;
  white-space: nowrap;
  cursor: pointer;
`

const Toggle = styled.button<{ $on: boolean }>`
  position: relative;
  width: 42px;
  height: 22px;
  flex-shrink: 0;
  padding: 0;
  border-radius: 11px;
  border: 1px solid ${p => (p.$on ? '#2a6' : '#ccc')};
  background: ${p => (p.$on ? '#2a6' : '#e0e0e0')};
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &::after {
    content: '';
    position: absolute;
    top: 1px;
    left: ${p => (p.$on ? '21px' : '1px')};
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    transition: left 0.15s;
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

// The app's top control bar: auth status/login + Generate PDF + Clear + AI dates +
// web-search toggle / Total-$ + song counter + sheet count + version.
export function ControlBar({
  auth,
  onLogin,
  onLogout,
  songs,
  ai,
}: ControlBarProps) {
  const {
    cards,
    songCounter,
    setSongCounter: onSongCounterChange,
    pdfLoading,
    handleGeneratePdf: onGeneratePdf,
    handleClearSongs: onClearSongs,
  } = songs
  const cardCount = cards.length
  // Free-text mirror of totalCost while the field is focused, so typing (incl.
  // intermediate states like "0.") isn't fought by the numeric value.
  const [totalCostInput, setTotalCostInput] = useState<string | null>(null)

  return (
    <Bar>
      {auth.kind === 'checking' && <AuthStatus>Checking login…</AuthStatus>}
      {auth.kind === 'out' && (
        <SpotifyButton onClick={onLogin}>Log in with Spotify</SpotifyButton>
      )}
      {auth.kind === 'in' && (
        <>
          <AuthStatus>Logged in as: {auth.user}</AuthStatus>
          <LogoutLink onClick={onLogout}>Log out</LogoutLink>
        </>
      )}
      <Button
        onClick={onGeneratePdf}
        disabled={cardCount === 0 || pdfLoading}
      >
        {pdfLoading ? 'Generating…' : 'Generate PDF'}
      </Button>
      <Button
        onClick={onClearSongs}
        disabled={cardCount === 0}
        title="Remove all songs from the list"
      >
        Clear Songs
      </Button>
      <Button
        onClick={ai ? ai.onDatesButton : undefined}
        // Disabled when the feature is off, when idle with nothing to query, and
        // during 'pausing' (the stop is committed, just finishing the current
        // song). While running it's the Pause control; while paused it's Resume.
        disabled={!ai || ai.aiStatus === 'pausing' || (ai.aiStatus === 'idle' && !ai.hasUnqueried)}
        title={!ai ? 'AI dates feature is disabled.\nAdd PERPLEXITY_API_KEY and set VITE_DATES_ENABLED=true in .env to enable.' : undefined}
      >
        {ai?.aiStatus === 'running'
          ? 'Pause'
          : ai?.aiStatus === 'pausing'
            ? 'Pausing…'
            : ai?.aiStatus === 'paused'
              ? 'Resume'
              : 'Get AI dates'}
      </Button>
      {ai && (
        <>
          <ToggleLabel title={ai.webSearchEnabled ? 'Disable web search' : 'Enable web search (≈0.5¢ per query)'}>
            Web search
            <Toggle
              type="button"
              $on={ai.webSearchEnabled}
              role="switch"
              aria-checked={ai.webSearchEnabled}
              onClick={ai.onToggleWebSearch}
            />
          </ToggleLabel>
          <AuthStatus>Total $</AuthStatus>
          <input
            type="text"
            inputMode="decimal"
            value={totalCostInput ?? ai.totalCost.toFixed(5)}
            onFocus={() => setTotalCostInput(ai.totalCost.toFixed(5))}
            onChange={e => setTotalCostInput(e.target.value)}
            onBlur={() => {
              const parsed = Number(totalCostInput)
              if (totalCostInput !== null && Number.isFinite(parsed) && parsed >= 0) {
                ai.onCommitTotalCost(parsed)
              }
              setTotalCostInput(null)
            }}
            title="Lifetime AI-query spend (USD). Editable to sync across ports/machines."
            style={{ width: 78, fontSize: '0.85rem', border: '1px solid #ddd', borderRadius: 4, background: 'white', textAlign: 'right', padding: '4px 6px' }}
          />
        </>
      )}
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
