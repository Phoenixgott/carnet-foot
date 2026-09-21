/**
 * Tests de bout en bout dans un vrai navigateur (Chromium), au format téléphone.
 * L'app construite (dist/) est servie localement par scripts/serve.mjs.
 */
import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    // Chromium complet (et non le « headless shell ») : plus proche de Chrome Android,
    // et seul à gérer les permissions de notification.
    channel: "chromium",
    baseURL: "http://localhost:4173",
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    serviceWorkers: "allow",
  },
  webServer: {
    command: "node scripts/serve.mjs dist 4173",
    url: "http://localhost:4173/",
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
