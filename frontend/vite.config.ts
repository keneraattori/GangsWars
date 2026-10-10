import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: {
      // forwards to the local Express backend (see docs/LOCAL_DEV.md)
      '/api': 'http://127.0.0.1:3000',
    },
  },
})
