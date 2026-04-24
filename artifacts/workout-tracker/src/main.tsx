import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { requestHealthKitAuthorization } from "@/lib/healthkit";

if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: false });
  StatusBar.setStyle({ style: Style.Dark });
  StatusBar.setBackgroundColor({ color: "#1a1a1a" });
  requestHealthKitAuthorization().catch(console.error);
}

createRoot(document.getElementById("root")!).render(<App />);
