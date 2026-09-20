import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // forwards to the local Express backend (see docs/LOCAL_DEV.md)
      '/api': 'http://localhost:3000',
    },
  },
})
