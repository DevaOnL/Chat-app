import React from "react";
import ReactDOM from "react-dom/client";
import ChatApp from "./ChatApp";
import ThemeToggle from "./themestoggle";
import { applyTheme } from "./themeUtils";

const savedTheme = localStorage.getItem("selectedTheme") || "Gruvbox";
applyTheme(savedTheme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeToggle />
    <ChatApp />
  </React.StrictMode>
);
