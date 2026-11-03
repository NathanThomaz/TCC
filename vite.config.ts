import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Um único Worker: o plugin Cloudflare executa a API no workerd local durante `vite dev`
// e gera o pacote de deploy (Worker + Static Assets) no `vite build`. O alias `@` aponta para
// src/web, como nas telas do laboratório (Telas-Lovable/tcc).
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src/web", import.meta.url)) } },
});
