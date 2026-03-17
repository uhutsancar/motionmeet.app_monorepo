import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import * as path from "path"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src'),
      '@clerk/clerk-react': path.resolve(__dirname, '../../node_modules/@clerk/clerk-react/dist/index.js'),
    },
    dedupe: ['react', 'react-dom'],
  },
  
  optimizeDeps: {
    include: ['@clerk/clerk-react'],
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
    }
  },

  build: {
    commonjsOptions: {
      include: [/@clerk\/clerk-react/, /node_modules/],
    },
    target: 'esnext',
    chunkSizeWarningLimit: 2000,
    minify: 'terser',
    sourcemap: true,
  }
})
