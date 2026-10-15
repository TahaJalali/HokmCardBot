import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "./styles.css";

const telegram = window.Telegram?.WebApp;
if (telegram) {
  telegram.ready();
  telegram.expand();
  telegram.setHeaderColor?.("#0b1713");
  telegram.setBackgroundColor?.("#0b1713");
  telegram.disableVerticalSwipes?.();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App telegramUser={telegram?.initDataUnsafe?.user} />
  </React.StrictMode>,
);
