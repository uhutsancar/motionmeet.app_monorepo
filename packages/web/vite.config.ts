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
    // Polling was on unconditionally, which makes the dev server stat the whole
    // source tree on a timer - expensive on a spinning disk, and paid for the
    // entire session. Native file events are the default now; set
    // VITE_WATCH_POLLING=true if you are editing over a network share or inside
    // a container bind mount, where those events do not arrive.
    watch: env.VITE_WATCH_POLLING === 'true' ? { usePolling: true } : undefined,
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
          // socket.io is deliberately NOT grouped with axios. A manual chunk is
          // emitted as one unit, so putting the realtime client next to the HTTP
          // client - which every screen imports - pinned ~88 KB of engine.io into
          // the entry graph and had the landing page preload it. Leaving it
          // unassigned lets Rollup follow the dynamic import in SocketProvider
          // and give it its own chunk, fetched only once somebody signs in.
          if (dependency === 'axios') return 'vendor-network'
          return undefined
        },
      },
    },
  }
  }
})
