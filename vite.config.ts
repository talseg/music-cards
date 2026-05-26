import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['tal-pc'],
    proxy: {
      '/api/spotify/token': {
        target: 'https://accounts.spotify.com',
        changeOrigin: true,
        rewrite: () => '/api/token',
      },
      '/api/spotify': {
        target: 'https://api.spotify.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/spotify/, ''),
      },
    },
  },
})
