import { defineConfig } from 'vite'

import apiLocalServer from './development/api-local-server'

export default defineConfig(({ mode }) => {
  if (mode === 'development') {
    apiLocalServer.createServer(5050)

    return {
      server: {
        proxy: {
          '/abc': {
            target: 'http://localhost:5050/',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/abc/, ''),
          },
        },
      },
    }
  }

  return {
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('abc2svg-1.js')) return 'abc2svg'
          },
        },
      },
    },
  }
})
