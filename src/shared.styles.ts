import styled from 'styled-components'

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
