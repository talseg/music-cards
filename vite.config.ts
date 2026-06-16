import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (empty prefix => includes non-VITE_ vars like the secret).
  const env = loadEnv(mode, process.cwd(), '')
  const clientId = env.VITE_SPOTIFY_CLIENT_ID
  const clientSecret = env.SPOTIFY_CLIENT_SECRET

  return {
    plugins: [react(), basicSsl()],
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
      },
    },
  }
})
