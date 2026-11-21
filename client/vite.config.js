import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on the local network too, so phones on the same Wi-Fi can open the app
    host: true,
    // During development, forward /api calls to the Express server
    proxy: { '/api': 'http://localhost:5000' },
  },
})
