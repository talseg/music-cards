import styled from 'styled-components'
import { getRedirectUri, disallowedPort } from '../auth/useAuth'
import { DashboardLink } from '../common/shared.styles'

// ─── Redirect URI hint styled-components ────────────────────────────────────────

// When the current address is a registrable one (127.0.0.1 on an allowed port)
// the hint is the usual muted reminder; on any other address (localhost, a LAN
// IP) it turns to a warning color — that URI either can't be registered or only
// stays registered until the machine's address changes.
const Hint = styled.div<{ $warning: boolean }>`
  margin: 0;
  font-size: 0.78rem;
  color: ${p => p.$warning ? '#b26a00' : '#aaa'};
  max-width: 680px;
  white-space: pre-wrap;
`

const Uri = styled.span<{ $warning: boolean }>`
  font-family: monospace;
  color: ${p => p.$warning ? '#b26a00' : '#888'};
`

// ─── Redirect URI hint ──────────────────────────────────────────────────────────

export function RedirectUriHint() {
  const warning = window.location.hostname !== '127.0.0.1' || disallowedPort !== null
  return (
    <Hint $warning={warning}>
      Make sure{' '}
      <Uri $warning={warning}>{getRedirectUri()}</Uri>{' '}
      is added in your{' '}
      <DashboardLink
        href="https://developer.spotify.com/dashboard"
        target="_blank"
        rel="noopener noreferrer"
      >
        Spotify Developer Dashboard
      </DashboardLink>
    </Hint>
  )
}
