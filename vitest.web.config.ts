import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src/web", import.meta.url)) } },
  test: {
    name: "web",
    environment: "jsdom",
    include: ["src/web/**/*.test.{ts,tsx}"],
  },
});
