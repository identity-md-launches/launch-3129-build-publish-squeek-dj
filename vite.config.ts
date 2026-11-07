import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base "./" keeps every asset URL relative, so the export works at an IPFS gateway subpath or an ENS name.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
