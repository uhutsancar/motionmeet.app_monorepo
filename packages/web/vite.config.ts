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
    chunkSizeWarningLimit: 600,
    minify: 'terser',
    sourcemap: env.VITE_BUILD_SOURCEMAP === 'true',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (
            /[\\/]react(?:-dom|-router)?[\\/]/.test(id)
            || id.includes('scheduler')
            || id.includes('@mui')
            || id.includes('@emotion')
          ) return 'vendor-core'
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
          if (id.includes('@reduxjs') || id.includes('react-redux') || id.includes('redux')) return 'vendor-state'
          if (id.includes('axios') || id.includes('socket.io') || id.includes('engine.io')) return 'vendor-network'
          return undefined
        },
      },
    },
  }
  }
})
