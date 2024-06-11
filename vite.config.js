import { defineConfig } from "vite";

export default defineConfig({
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
