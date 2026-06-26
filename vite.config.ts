import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

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
    plugins: [react(), basicSsl(), ...(scNames ? [styledComponentsNames()] : [])],
    server: {
      host: true,
      https: {},
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
