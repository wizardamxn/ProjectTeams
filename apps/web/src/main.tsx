import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { ThemeProvider } from "next-themes";
import App from "./App";
import { store } from "./store/store";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <Provider store={store}>
    {/* Dark by default; light and "follow the system" are a click away (sidebar or Profile). */}
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="pt-theme" disableTransitionOnChange>
      <App />
    </ThemeProvider>
  </Provider>,
);
