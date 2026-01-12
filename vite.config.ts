
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000
  },
  define: {
    // 確保 process.env.API_KEY 在前端可以被讀取
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});
