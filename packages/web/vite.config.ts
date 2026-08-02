import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const dependencyName = (id: string): string | null => {
  const normalized = id.replace(/\\/g, '/')
  const marker = '/node_modules/'
  const index = normalized.lastIndexOf(marker)
  if (index < 0) return null
  const dependencyPath = normalized.slice(index + marker.length)
  const segments = dependencyPath.split('/')
  return dependencyPath.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0] || null
}

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
          const dependency = dependencyName(id)
          if (!dependency) return undefined
          if (
            ['react', 'react-dom', 'react-is', 'react-router', 'scheduler'].includes(dependency)
            || dependency.startsWith('@mui/')
            || dependency.startsWith('@emotion/')
          ) return 'vendor-core'
          if (dependency.startsWith('@reduxjs/') || ['react-redux', 'redux', 'redux-thunk', 'reselect', 'immer'].includes(dependency)) return 'vendor-state'
          if (dependency === 'axios' || dependency.includes('socket.io') || dependency.includes('engine.io') || dependency === '@socket.io/component-emitter') return 'vendor-network'
          return undefined
        },
      },
    },
  }
  }
})
