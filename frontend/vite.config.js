import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "https://YOUR_BACKEND_URL",  // ← 等你部署完 backend 請我幫你填
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: "dist",
  }
});
