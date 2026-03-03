import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '',
  optimizeDeps: {
    include: ['@mui/material', '@mui/styled-engine', '@mui/system'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (
            id.includes('@mui/material') ||
            id.includes('@mui/icons-material') ||
            id.includes('@emotion/')
          ) {
            return 'mui';
          }

          if (id.includes('qapp-core')) {
            return 'qapp-core';
          }

          if (id.includes('jotai')) {
            return 'state';
          }

          if (id.includes('i18next') || id.includes('react-i18next')) {
            return 'i18n';
          }

          return undefined;
        },
      },
    },
  },
});
