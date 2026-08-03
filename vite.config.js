import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }))
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('sweetalert2')) return 'vendor-swal';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('react')) return 'vendor-react';
            return 'vendor';
          }
        }
      }
    }
  }
})
