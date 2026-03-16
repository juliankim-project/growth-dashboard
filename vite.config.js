import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          /* 큰 vendor 라이브러리를 별도 chunk로 분리 — 캐싱 효율 극대화 */
          'vendor-react': ['react', 'react-dom'],
          'vendor-recharts': ['recharts'],
          'vendor-grid': ['react-grid-layout'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
    /* 큰 chunk 경고 임계값 (recharts 등) */
    chunkSizeWarningLimit: 600,
  },
})
