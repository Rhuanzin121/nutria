import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/nutria/" : "/",
  plugins: [react(), tailwindcss()],
  test: { environment: "node" },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "nutrition-data", test: /taco\.json|usda\.json/ },
            { name: "supabase", test: /@supabase/ },
            { name: "vendor", test: /node_modules/ },
          ],
        },
      },
    },
  },
});
