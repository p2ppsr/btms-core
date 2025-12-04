// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  root: resolve(__dirname), // <-- IMPORTANT
  publicDir: resolve(__dirname, 'public'), // ensure public assets resolve correctly

  plugins: [react()],

  server: {
    port: 5173,
    strictPort: false
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },

  build: {
    outDir: resolve(__dirname, 'dist'), // output stays inside frontend/dist
    emptyOutDir: true,
    sourcemap: true,
    manifest: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html') // <-- ensure correct entrypoint
    }
  }
})
