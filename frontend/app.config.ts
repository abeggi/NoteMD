import { defineConfig } from "@solidjs/start/config";
import UnoCSS from "unocss/vite";

export default defineConfig({
  vite: {
    plugins: [UnoCSS()],
    server: {
      allowedHosts: ["note.begginet.com"],
    },
  },
  server: {
    preset: "node-server",
    routeRules: {
      "/api/**": {
        proxy: "http://localhost:3001/api/**",
      },
    },
  },
});
