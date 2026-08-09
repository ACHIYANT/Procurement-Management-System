import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

if (localStorage.getItem("pms_dark_mode_enabled") === "true") {
  document.documentElement.classList.add("pms-dark");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/pms-reminder-sw.js")
      .then((registration) => registration.update().catch(() => {}))
      .catch(() => {
        // Reminder notifications still fall back to normal browser notifications.
      });
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
