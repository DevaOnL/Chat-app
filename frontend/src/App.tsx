import React from "react";
import ThemeToggle from "./themestoggle";
import ChatApp from "./ChatApp";

const App = () => {
  return (
    <div style={{ backgroundColor: "var(--bg)", color: "var(--fg)", minHeight: "100vh" }}>
      <ThemeToggle />
      <ChatApp />
    </div>
  );
};

export default App;
//ohhh