import styled from 'styled-components'
import type { AiState } from '../ai/useAiDates'
import { Button } from '../common/shared.styles'

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

// ─── WebSearchConfirmModal ──────────────────────────────────────────────────────

export function WebSearchConfirmModal({ ai }: { ai?: AiState }) {
  if (!ai?.confirmWebSearch) return null

  return (
    <ModalOverlay onClick={ai.closeWebSearchConfirm}>
      <ModalBox onClick={e => e.stopPropagation()}>
        <ModalText>
          Web search is expensive (~0.5 cent per query). Are you sure you
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
  )
}
