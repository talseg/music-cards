import { SongList } from './components/SongList'
import { SheetPreview } from './components/SheetPreview'
import { ControlBar } from './components/ControlBar'
import { WebSearchConfirmModal } from './components/WebSearchConfirmModal'
import { Button } from './common/shared.styles'
import { useAuth, getRedirectUri } from './auth/useAuth'
import { useAiDates } from './ai/useAiDates'
import { useSongs } from './songs/useSongs'
import styled from 'styled-components'

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

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const { auth, loggedIn, login, logout } = useAuth()
  const {
    cards,
    selectedId,
    setSelectedId,
    songCounter,
    setSongCounter,
    input,
    setInput,
    importing,
    importDisabled,
    importDisabledReason,
    pdfLoading,
    error,
    clearError,
    inputRef,
    handleImport,
    handleDelete,
    updateCardField,
    handleGeneratePdf,
    handleClearSongs,
  } = useSongs(loggedIn)
  const ai = useAiDates(cards, clearError)

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
        ai={ai}
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

        {/* Combined import row: type inferred from the pasted link */}
        <InputRow>
          <FieldLabel htmlFor="spotify-link">Add / Import</FieldLabel>
          <DisabledHint title={importDisabledReason}>
            <Input
              id="spotify-link"
              ref={inputRef}
              type="text"
              autoComplete="off"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleImport() }}
              placeholder="Paste a Spotify track, album, or playlist link…"
              disabled={importing}
            />
            <Button $primary onClick={handleImport} disabled={importDisabled}>
              {importing ? 'Adding…' : 'Add'}
            </Button>
          </DisabledHint>
        </InputRow>

        {error && <ErrorText>{error}</ErrorText>}

        {/* Song list */}
        <SongList
          cards={cards}
          selectedId={selectedId}
          ai={ai}
          onSelect={setSelectedId}
          onApplyYear={(id, year) => updateCardField(id, 'year', year)}
          onDelete={handleDelete}
        />
      </TopPanel>

      <SheetPreview
        cards={cards}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onFieldChange={updateCardField}
      />

      <WebSearchConfirmModal ai={ai} />
    </AppWrapper>
  )
}

export default App
