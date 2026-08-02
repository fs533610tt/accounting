import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/accounting/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }))
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
})
