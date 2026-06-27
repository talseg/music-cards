import styled from 'styled-components'
import { Button } from '../common/shared.styles'
import type { SongsInterface } from '../songs/useSongs'

// ─── Song input styled-components ───────────────────────────────────────────────

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

// Wrapper that still receives hover events when the controls inside are
// disabled, so the "must be logged in" tooltip actually appears.
const DisabledHint = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
`

// ─── Song input ─────────────────────────────────────────────────────────────────

export function SongInput({ songs }: { songs: SongsInterface }) {
  const {
    input,
    setInput,
    importing,
    importDisabled,
    importDisabledReason,
    error,
    inputRef,
    handleImport,
  } = songs

  return (
    <>
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
    </>
  )
}
