import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Ensure a single React copy is bundled. @testing-library/react pulls a
    // second (react@18) copy into the tree; without dedupe the production
    // build can bind hooks to the wrong instance ("useRef of null").
    dedupe: ["react", "react-dom"],
  },
  server: {
    proxy: {
      "/api": "http://localhost:3333",
      "/ws": {
        target: "ws://localhost:3333",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
