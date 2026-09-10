import React from "react";
import ReactDOM from "react-dom/client";
// Tatva's tokens, base styles and font faces must load before the app's own
// CSS so the @tailwind layers can override the design system's base, not the
// other way round (same order as apps/web's layout.tsx).
import "@sarvam/tatva/styles.css";
import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
