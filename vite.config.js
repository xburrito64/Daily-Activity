import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { loadJson } from './server/config.js'

const { port } = loadJson('config.json')

/**
 * The dev server answers unknown paths with index.html, so a font file that
 * isn't there yet arrives as HTML and the browser reports a parse error
 * instead of a plain miss. Say "not found" and let the fallback font win.
 */
function missingFontsAre404() {
  return {
    name: 'missing-fonts-are-404',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/fonts/')) return next()
        const file = path.join('public', decodeURIComponent(req.url.split('?')[0]))
        if (fs.existsSync(file)) return next()
        res.statusCode = 404
        res.end()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), missingFontsAre404()],
  server: {
    port: 5273,
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${port}` },
  },
})
