import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {previewGuard} from "./scripts/preview-guard.mjs";

export default defineConfig(({mode}) => ({
  plugins: [react(), ...(mode === "preview" ? [previewGuard()] : [])],
  build: {
    emptyOutDir: false,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replaceAll("\\", "/");
          if (moduleId.includes("/node_modules/lucide-react/")) return "icons";
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(moduleId)) return "react-vendor";
          if (moduleId.includes("/node_modules/jspdf/")) return "pdf-vendor";
          if (moduleId.includes("/node_modules/html-to-image/")) return "image-export-vendor";
          if (moduleId.includes("/node_modules/rrweb/")) return "replay-vendor";
          return undefined;
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    proxy: mode === 'preview' ? undefined : { '/api': 'http://127.0.0.1:4175' },
  },
}));
