import React from "react";
import { createRoot } from "react-dom/client";
import { TerminalApp as App } from "./ReplayDesk.js";
import "./evidence-desk.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
