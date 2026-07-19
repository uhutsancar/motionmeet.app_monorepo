import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
  const rootDirectory = fileURLToPath(new URL('.', import.meta.url))
  const env = loadEnv(mode, rootDirectory, '')

  return {
  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['react', 'react-dom'],
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
    }
  },

  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 2000,
    minify: 'terser',
    sourcemap: env.VITE_BUILD_SOURCEMAP === 'true',
  }
  }
})
