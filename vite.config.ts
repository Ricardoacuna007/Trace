import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 40,
            },
            {
              name: 'blocknote-vendor',
              test: /node_modules[\\/](@blocknote|@tiptap|prosemirror|yjs|lib0)[\\/]/,
              maxSize: 260_000,
              priority: 35,
            },
            {
              name: 'mantine-vendor',
              test: /node_modules[\\/](@mantine|@floating-ui)[\\/]/,
              maxSize: 220_000,
              priority: 30,
            },
            {
              name: 'graph-vendor',
              test: /node_modules[\\/](d3|d3-[^\\/]+)[\\/]/,
              priority: 25,
            },
            {
              name: 'tauri-vendor',
              test: /node_modules[\\/]@tauri-apps[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              maxSize: 260_000,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
  },
})
