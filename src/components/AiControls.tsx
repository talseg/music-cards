import styled from 'styled-components'
import type { CardData } from '../common/types'
import type { AiState } from '../ai/useAiDates'
import { Button, MutedLabel } from '../common/shared.styles'
import { TotalCostField } from './TotalCostField'

// ─── AI controls styled-components ──────────────────────────────────────────────

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

interface AiControlsProps {
  ai: AiState
  // The songs the AI glass acts on (the current selection).
  selectedCards: CardData[]
}

// The AI-dates cluster of the control bar: the AI glass (date the selection) /
// Pause / Resume control, the web-search toggle, and the Total-$ field.
export function AiControls({ ai, selectedCards }: AiControlsProps) {
  return (
    <>
      <Button
        // One control whose icon shows the state: 🔍 idle ⇒ (re-)query the
        // selected songs; ⏸ running ⇒ pause; ▶ paused ⇒ resume. Disabled
        // mid-pause, or when idle with no selection.
        onClick={() => ai.aiStatus === 'idle' ? ai.onRunSelected(selectedCards) : ai.onPauseResume()}
        disabled={ai.aiStatus === 'pausing' || (ai.aiStatus === 'idle' && selectedCards.length === 0)}
        title={
          ai.aiStatus === 'running' ? 'Pause the AI run'
            : ai.aiStatus === 'pausing' ? 'Pausing…'
              : ai.aiStatus === 'paused' ? 'Resume the AI run'
                : 'Get AI dates for the selected songs'
        }
      >
        {ai.aiStatus === 'running' || ai.aiStatus === 'pausing'
          ? '⏸'
          : ai.aiStatus === 'paused' ? '▶' : '🔍'}
      </Button>
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
      <MutedLabel>Total $</MutedLabel>
      <TotalCostField value={ai.totalCost} onCommit={ai.onCommitTotalCost} />
    </>
  )
}
