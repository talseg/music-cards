import { SongList } from './components/SongList'
import { SheetPreview } from './components/SheetPreview'
import { ControlBar } from './components/ControlBar'
import { SongInput } from './components/SongInput'
import { RedirectUriHint } from './components/RedirectUriHint'
import { WebSearchConfirmModal } from './components/WebSearchConfirmModal'
import { useAuth } from './auth/useAuth'
import { useAiDates } from './ai/useAiDates'
import { useSongs } from './songs/useSongs'
import styled from 'styled-components'

// ─── Styled Components ────────────────────────────────────────────────────────

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 32px 40px;
  min-height: 100vh;
  background: #fafafa;
`

const ItemsContainer = styled.div`
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
    selectedIds,
    previewId,
    selectSingle,
    toggleSelect,
    selectRange,
    toggleSelectAll,
    navigatePreview,
    clearError,
    handleDelete,
    updateCardField,
  } = songsInterface
  const ai = useAiDates(clearError, selectedIds)

  return (
    <AppContainer className='app_wrapper'>
      <ItemsContainer>
        {/* Top control bar: login status + Generate PDF + AI dates + counter + sheets + version */}
        <ControlBar
          auth={auth}
          onLogin={login}
          onLogout={logout}
          songs={songsInterface}
          ai={ai}
        />
        {auth.kind === 'out' && auth.error && <AuthError>{auth.error}</AuthError>}

        {/* Redirect URI hint when logged out */}
        {auth.kind === 'out' && <RedirectUriHint />}

        <SongInput songs={songsInterface} />

        {/* Song list */}
        <SongList
          cards={cards}
          selectedIds={selectedIds}
          previewId={previewId}
          ai={ai}
          onSelectSingle={selectSingle}
          onToggle={toggleSelect}
          onRange={selectRange}
          onToggleAll={toggleSelectAll}
          onApplyField={updateCardField}
          onDelete={handleDelete}
        />

        <SheetPreview
          cards={cards}
          selectedIds={selectedIds}
          previewId={previewId}
          onSelect={selectSingle}
          onNavigate={navigatePreview}
          onFieldChange={updateCardField}
        />
        
      </ItemsContainer>

      {/* Hidden onfirmation dialog */}
      <WebSearchConfirmModal ai={ai} />
    </AppContainer>
  )
}

export default App
