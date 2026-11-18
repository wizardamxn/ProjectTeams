import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // `vite preview` mirrors production: same origin, API + sockets proxied.
  preview: {
    proxy: {
      "/api": { target: "http://localhost:2222", changeOrigin: true },
      "/socket.io": { target: "http://localhost:2222", ws: true },
    },
  },
}));
