import { SongList } from './components/SongList'
import { SheetPreview } from './components/SheetPreview'
import { ControlBar } from './components/ControlBar'
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

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const { auth, loggedIn, login, logout } = useAuth()
  const {
    cards,
    selectedId,
    setSelectedId,
    songCounter,
    setSongCounter,
    urlInput,
    setUrlInput,
    playlistInput,
    setPlaylistInput,
    loading,
    playlistLoading,
    pdfLoading,
    error,
    clearError,
    inputRef,
    handleImportPlaylist,
    handleAdd,
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
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
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
