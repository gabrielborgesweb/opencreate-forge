import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'src/main/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
      preload: {
        input: 'src/main/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
      // Removendo o objeto vazio 'renderer' para evitar o erro de detecção automática do plugin
      // Se precisarmos de 'require' no renderer, usaremos o plugin separadamente.
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@ui': path.resolve(__dirname, './src/renderer'),
      '@store': path.resolve(__dirname, './src/renderer/store'),
    },
  },
  build: {
    emptyOutDir: true,
  },
})
