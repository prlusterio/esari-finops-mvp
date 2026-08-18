import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync, cpSync, createReadStream, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = path.resolve(__dirname, 'docs')
const USER_GUIDE_DOCX = path.join(DOCS_DIR, 'user-guide.docx')
const USER_GUIDE_HTML = path.join(DOCS_DIR, 'user-guide.html')
const USER_GUIDE_ASSETS = path.join(DOCS_DIR, 'user-guide-assets')
const COMPUTATIONS_XLSX = path.join(DOCS_DIR, 'esari-computations.xlsx')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx':
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

function safeJoin(root, relativePath) {
  const resolved = path.resolve(root, relativePath)
  if (!resolved.startsWith(root)) return null
  return resolved
}

function sendFile(res, filePath, { downloadName } = {}) {
  const ext = path.extname(filePath).toLowerCase()
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
  if (downloadName) {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${downloadName}"`,
    )
  }
  createReadStream(filePath).pipe(res)
}

function publishUserGuide() {
  return {
    name: 'publish-user-guide',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent(req.url?.split('?')[0] || '')
        if (url === '/user-guide.html' && existsSync(USER_GUIDE_HTML)) {
          sendFile(res, USER_GUIDE_HTML)
          return
        }
        if (url === '/user-guide.docx' && existsSync(USER_GUIDE_DOCX)) {
          sendFile(res, USER_GUIDE_DOCX)
          return
        }
        if (url === '/esari-computations.xlsx' && existsSync(COMPUTATIONS_XLSX)) {
          sendFile(res, COMPUTATIONS_XLSX, {
            downloadName: 'esari-computations.xlsx',
          })
          return
        }
        if (url.startsWith('/user-guide-assets/')) {
          const relative = url.slice('/user-guide-assets/'.length)
          const filePath = safeJoin(USER_GUIDE_ASSETS, relative)
          if (filePath && existsSync(filePath)) {
            sendFile(res, filePath)
            return
          }
        }
        next()
      })
    },
    closeBundle() {
      const dist = path.resolve(__dirname, 'dist')
      if (existsSync(USER_GUIDE_HTML)) {
        copyFileSync(USER_GUIDE_HTML, path.join(dist, 'user-guide.html'))
      }
      if (existsSync(USER_GUIDE_DOCX)) {
        copyFileSync(USER_GUIDE_DOCX, path.join(dist, 'user-guide.docx'))
      }
      if (existsSync(COMPUTATIONS_XLSX)) {
        copyFileSync(COMPUTATIONS_XLSX, path.join(dist, 'esari-computations.xlsx'))
      }
      if (existsSync(USER_GUIDE_ASSETS)) {
        cpSync(USER_GUIDE_ASSETS, path.join(dist, 'user-guide-assets'), {
          recursive: true,
        })
      }
    },
  }
}

export default defineConfig({
  // Local/dev uses `/`. GitHub Pages project site uses `/esari-finops-mvp/`.
  base: process.env.GITHUB_PAGES === 'true' ? '/esari-finops-mvp/' : '/',
  plugins: [react(), tailwindcss(), publishUserGuide()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
