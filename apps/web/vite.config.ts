import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { iconsSpritesheet } from "vite-plugin-icons-spritesheet"

export default defineConfig({
  server: {
    port: 4000,
  },
  plugins: [
    react(),
    tailwindcss(),
    iconsSpritesheet([
      {
        withTypes: true,
        inputDir: "src/assets/icons/file-types",
        outputDir: "src/shared/components/file-icons",
        formatter: "biome",
      },
    ]),
  ],
  publicDir: "assets",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["@ifc-viewer/viewer"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          ifc: ["@ifc-viewer/viewer"],
        },
      },
    },
  },
})
