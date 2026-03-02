import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Build the widget as a single self-contained JS file (IIFE).
 * The output `widget.js` is what customers embed via a script tag.
 * 
 * We inline all CSS into JS using a custom plugin so the bundle
 * is truly one file — no separate CSS import needed on the customer's site.
 */
export default defineConfig({
  plugins: [react()],
  define: {
    // Needed to tree-shake React devtools in production
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    lib: {
      entry: 'src/main.jsx',
      name: 'ChattyBot',
      fileName: () => 'widget.js',
      formats: ['iife'], // IIFE = works as a plain <script> tag
    },
    rollupOptions: {
      // Bundle React into the widget — customers don't have React on their site
      external: [],
      output: {
        inlineDynamicImports: true,
      },
    },
    cssCodeSplit: false, // Inline CSS into the JS bundle
    minify: true,
    outDir: 'dist',
  },
});
