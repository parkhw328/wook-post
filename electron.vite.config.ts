import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    plugins: [react()],
    build: { minify: true },
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    server: { host: '127.0.0.1', strictPort: true },
  },
})
