import styled from 'styled-components'

// Small muted inline label shared by the control bar (auth status) and the AI
// cluster (the "Total $" caption).
export const MutedLabel = styled.span`
  font-size: 0.85rem;
  color: #555;
`

// Shared button used across the app (control bar, input rows, modal).
export const Button = styled.button<{ $primary?: boolean }>`
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

// One explicit height for the control-bar action buttons so they line up exactly
// (aspect-ratio can't drive a flex item's width, so square needs real pixels).
const BAR_BUTTON_HEIGHT = '38px'

// Generate-PDF-style toolbar button pinned to the shared height (keeps its label
// and side padding).
export const BarButton = styled(Button)`
  height: ${BAR_BUTTON_HEIGHT};
`

// Square icon button for the control bar (trash, AI glass): width === height at
// the shared button height, contents centered.
export const IconButton = styled(Button)`
  width: ${BAR_BUTTON_HEIGHT};
  height: ${BAR_BUTTON_HEIGHT};
  flex-shrink: 0;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`

// Checkbox shared by the song list's header (select-all) and each row, sized to
// the column. Inherits its cursor from the surrounding select-zone.
export const RowCheckbox = styled.input`
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin: 0;
  cursor: inherit;
`
