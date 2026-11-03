import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Um único Worker: o plugin Cloudflare executa a API no workerd local durante `vite dev`
// e gera o pacote de deploy (Worker + Static Assets) no `vite build`.
export default defineConfig({
  plugins: [react(), cloudflare()],
});
