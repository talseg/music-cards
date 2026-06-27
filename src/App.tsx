import { SongList } from './components/SongList'
import { SheetPreview } from './components/SheetPreview'
import { ControlBar } from './components/ControlBar'
import { SongInput } from './components/SongInput'
import { WebSearchConfirmModal } from './components/WebSearchConfirmModal'
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

// ─── Auth error ───────────────────────────────────────────────────────────────

const AuthError = styled.div`
  color: #cc0000;
  font-size: 0.82rem;
  white-space: pre-wrap;
  max-width: 680px;
`

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const { auth, loggedIn, login, logout } = useAuth()
  const songsInterface = useSongs(loggedIn)
  const {
    cards,
    selectedId,
    setSelectedId,
    clearError,
    handleDelete,
    updateCardField,
  } = songsInterface
  const ai = useAiDates(cards, clearError)

  return (
    <AppWrapper className='app_wrapper'>
      {/* Top control bar: login status + Generate PDF + AI dates + counter + sheets + version */}
      <ControlBar
        auth={auth}
        onLogin={login}
        onLogout={logout}
        songs={songsInterface}
        ai={ai}
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

        <SongInput songs={songsInterface} />

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
