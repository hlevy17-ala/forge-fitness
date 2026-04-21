import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: false });
  StatusBar.setStyle({ style: Style.Dark });
  StatusBar.setBackgroundColor({ color: "#1a1a1a" });
}

createRoot(document.getElementById("root")!).render(<App />);
