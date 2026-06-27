import styled from 'styled-components'
import { getRedirectUri } from '../auth/useAuth'

// ─── Redirect URI hint styled-components ────────────────────────────────────────

const Hint = styled.div`
  margin: 0;
  font-size: 0.78rem;
  color: #aaa;
  max-width: 680px;
  white-space: pre-wrap;
`

const Uri = styled.span`
  font-family: monospace;
  color: #888;
`

const DashboardLink = styled.a`
  color: #0052cc;
`

// ─── Redirect URI hint ──────────────────────────────────────────────────────────

export function RedirectUriHint() {
  return (
    <Hint>
      Make sure{' '}
      <Uri>{getRedirectUri()}</Uri>{' '}
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
