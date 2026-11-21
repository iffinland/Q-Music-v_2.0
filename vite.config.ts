import packageInfo from './package.json';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const { version } = packageInfo;

// package.json is the single version source for the bundle and document title.
export default defineConfig({
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(version) },
  plugins: [
    react(),
    {
      name: 'qmusic-build-version',
      transformIndexHtml: (html) => html.replaceAll('__APP_VERSION__', version),
    },
  ],
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
