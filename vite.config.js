import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Mode is passed via --mode (staging | production) and selects the matching
// .env.[mode] file. VITE_APP_ENV inside that file is the single source of
// truth the Firebase service layer reads to choose its project config.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    sourcemap: mode !== 'production',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
          'vendor-ui': ['recharts', 'lucide-react'],
        },
      },
    },
  },
}))
