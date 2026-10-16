import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base 用相对路径，部署在任意子路径下都能加载资源
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', demo: 'demo.html' },
    },
  },
});
