import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

if (localStorage.getItem("pms_dark_mode_enabled") === "true") {
  document.documentElement.classList.add("pms-dark");
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
