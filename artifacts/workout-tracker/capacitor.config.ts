import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.harrylevy.forgefit",
  appName: "Forge",
  webDir: "dist/public",
  server: {
    url: "https://forge-fitness-production-37bc.up.railway.app",
    cleartext: false,
  },
  ios: {
    backgroundColor: "#09090b",
  },
};

export default config;
