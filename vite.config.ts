import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'node:fs'

// ── Allowed ports ─────────────────────────────────────────────────────────────
// The redirect URIs the app may run on live in allowed-redirect-uris.txt (repo
// root, committed) so users can copy them straight into the Spotify dashboard.
// Only the ports are enforced; they are injected into the bundle below and
// checked in src/auth/useAuth.ts. Editing the file requires a server restart.
const DEFAULT_ALLOWED_PORTS = ['5173', '4173', '4444']

function readAllowedPorts(): string[] {
  try {
    const lines = fs.readFileSync('allowed-redirect-uris.txt', 'utf-8').split('\n')
    const ports = lines
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => new URL(line).port)
      .filter(port => port !== '')
    if (ports.length === 0) throw new Error('no URIs with an explicit port found')
    return [...new Set(ports)]
  } catch (e) {
    console.warn(
      `[allowed-redirect-uris] falling back to default ports ${DEFAULT_ALLOWED_PORTS.join(', ')}: ${
        e instanceof Error ? e.message : e}`,
    )
    return DEFAULT_ALLOWED_PORTS
  }
}

// ── dev:sc only ───────────────────────────────────────────────────────────────
// Debug helper, active solely under `npm run dev:sc` (vite --mode sc). It runs
// babel-plugin-styled-components so styled components get readable names in React
// DevTools and in the generated class names. It does NOT run for `npm run dev` or
// `npm run build`, and touches no source file on disk (transform is in-memory).
//
// To remove this feature entirely: delete this function, drop `scNames` and its use
// in `plugins` below, remove the "dev:sc" script in package.json, then
// `npm uninstall @babel/core babel-plugin-styled-components`.
function styledComponentsNames(): Plugin {
  return {
    name: 'styled-components-names',
    enforce: 'pre',
    async transform(code, id) {
      if (id.includes('/node_modules/') || !/\.[jt]sx?$/.test(id) || !code.includes('styled')) {
        return
      }
      // @ts-expect-error -- @babel/core ships no bundled types; loaded lazily, dev-only.
      const babel = await import('@babel/core')
      const result = await babel.transformAsync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        // Parse TS + JSX directly and emit it back (no type stripping) so oxc still
        // handles the actual transform — keeps this to a single dependency.
        parserOpts: { plugins: ['typescript', 'jsx'] },
        plugins: [['babel-plugin-styled-components', { displayName: true }]],
      })
      if (result?.code) return { code: result.code, map: result.map }
    },
  }
}

// ── Terminal banner ───────────────────────────────────────────────────────────
// Print the Local URL as 127.0.0.1 — the dashboard-registrable address — instead
// of localhost, so Ctrl+click lands on an origin where Spotify login works.
function loopbackBanner(): Plugin {
  const patchPrintUrls = (server: {
    printUrls: () => void
    resolvedUrls: { local: string[] } | null
  }) => {
    const printUrls = server.printUrls.bind(server)
    server.printUrls = () => {
      if (server.resolvedUrls) {
        server.resolvedUrls.local = server.resolvedUrls.local.map(
          u => u.replace('//localhost:', '//127.0.0.1:'),
        )
      }
      printUrls()
    }
  }
  return {
    name: 'loopback-banner',
    configureServer: patchPrintUrls,
    configurePreviewServer: patchPrintUrls,
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (empty prefix => includes non-VITE_ vars like the secret).
  const env = loadEnv(mode, process.cwd(), '')
  const clientId = env.VITE_SPOTIFY_CLIENT_ID
  const clientSecret = env.SPOTIFY_CLIENT_SECRET
  const perplexityKey = env.PERPLEXITY_API_KEY

  // `vite --mode sc` (npm run dev:sc) enables readable styled-component names.
  const scNames = mode === 'sc'

  return {
    plugins: [react(), basicSsl(), loopbackBanner(), ...(scNames ? [styledComponentsNames()] : [])],
    define: {
      'import.meta.env.VITE_ALLOWED_PORTS': JSON.stringify(readAllowedPorts().join(',')),
    },
    preview: {
      strictPort: true,
    },
    server: {
      host: true,
      https: {},
      // Fail fast when the port is busy instead of silently bumping to the next
      // one — a bumped port isn't registered as a Spotify redirect URI.
      strictPort: true,
      allowedHosts: ['tal-pc'],
      proxy: {
        '/api/spotify/token': {
          target: 'https://accounts.spotify.com',
          changeOrigin: true,
          rewrite: () => '/api/token',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Build the client-credentials Basic auth header server-side so
              // the secret never reaches the browser bundle.
              if (clientId && clientSecret) {
                const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
                proxyReq.setHeader('Authorization', `Basic ${basic}`)
              }
            })
          },
        },
        '/api/spotify': {
          target: 'https://api.spotify.com/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/spotify/, ''),
        },
        '/api/perplexity': {
          target: 'https://api.perplexity.ai',
          changeOrigin: true,
          rewrite: () => '/v1/agent',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Attach the Perplexity API key server-side so the secret never
              // reaches the browser bundle. The browser sends only { model, input }.
              if (perplexityKey) {
                proxyReq.setHeader('Authorization', `Bearer ${perplexityKey}`)
              }
            })
          },
        },
      },
    },
  }
})
