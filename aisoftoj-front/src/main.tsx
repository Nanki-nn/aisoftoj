
  import { createRoot } from "react-dom/client";
  import { createBrowserRouter, RouterProvider } from "react-router-dom";
  import App from "./App.tsx";
  import { AuthProvider } from "./hooks/useAuth";
  import { ThemeProvider } from "./hooks/useTheme";
  import "./index.css";

  const router = createBrowserRouter([
    {
      path: "*",
      element: (
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
      ),
    },
  ]);

  createRoot(document.getElementById("root")!).render(
    <RouterProvider router={router} />
  );
  
