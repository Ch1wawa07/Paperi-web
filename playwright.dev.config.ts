import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "pdf-dev.spec.ts",
  testIgnore: [],
  workers: 1,
  use: { ...base.use, baseURL: "http://127.0.0.1:3105" },
  webServer: {
    command: "npm run dev -- --webpack --hostname 127.0.0.1 --port 3105",
    url: "http://127.0.0.1:3105",
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      DEEPSEEK_API_KEY: "",
      AI_API_KEY: "",
      AI_MODEL: "",
      AI_BASE_URL: "",
      OPENALEX_API_KEY: "",
    },
  },
});
