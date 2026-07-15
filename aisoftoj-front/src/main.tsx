
  import { createRoot } from "react-dom/client";
  import { BrowserRouter } from "react-router-dom";
  import App from "./App.tsx";
  import { AuthProvider } from "./hooks/useAuth";
  import { ThemeProvider } from "./hooks/useTheme";
  import "./index.css";

  createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
  
