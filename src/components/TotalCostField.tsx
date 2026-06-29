import { useState } from 'react'
import styled from 'styled-components'

interface TotalCostFieldProps {
  // The committed lifetime AI-query spend (USD).
  value: number
  // Commit a new, validated value (>= 0). Persists upstream.
  onCommit: (n: number) => void
}

const InputStyled = styled.input`
  width: 78px;
  font-size: 0.85rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  text-align: right;
  padding: 4px 6px; 
`

// The "Total $" field from the control bar: shows the committed lifetime AI-query
// spend, and on focus becomes an editable text mirror so typing intermediate
// states (e.g. "0.") isn't fought by the numeric value. On blur a valid, >= 0
// number is committed; anything else is discarded (reverts to the committed value).
export function TotalCostField({ value, onCommit }: TotalCostFieldProps) {
  // Free-text mirror while focused; null when not editing (then we show `value`).
  const [input, setInput] = useState<string | null>(null)

  return (
    <InputStyled
      type="text"
      inputMode="decimal"
      value={input ?? value.toFixed(5)}
      onFocus={() => setInput(value.toFixed(5))}
      onChange={e => setInput(e.target.value)}
      onBlur={() => {
        const parsed = Number(input)
        if (input !== null && Number.isFinite(parsed) && parsed >= 0) {
          onCommit(parsed)
        }
        setInput(null)
      }}
      title="Lifetime AI-query spend (USD). Editable to sync across ports/machines."
    />
  )
}
