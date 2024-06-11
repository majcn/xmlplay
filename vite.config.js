import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      '/abc': {
        target: 'https://note-b7n.pages.dev/abc',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/abc/, ''),
      },
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("abc2svg-1.js")) return "abc2svg";
        },
      },
    },
  },
});
