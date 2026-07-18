import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Forwards /api requests to FastAPI during local development
    // so the frontend never needs to hardcode a backend origin.
    proxy: {
      '/api': {
        target: 'http://54.147.6.119:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
