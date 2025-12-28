import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { addUser, checkAuth } from "./store/slices/User";
import axios from "axios";
import { listenToMessages } from "./store/slices/SocketThunks";

// --- Components & Pages ---
import Layout from "./components/Layout"; // Make sure you created this file!
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import Editor from "./pages/Editor";
import Chat, { ChatMember } from "./pages/Chat";
import Team from "./pages/Team";
import NotFound from "./pages/NotFound";
import ProfilePage from "./pages/Profile";
import Create from "./pages/Create";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  // --- Public Routes (No Sidebar/Navbar) ---
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },

  // --- Private Routes (Wrapped in Layout) ---
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />, // This keeps Sidebar/Navbar persistent
        children: [
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/documents", element: <Documents /> },
          { path: "/team", element: <Team /> },
          { path: "/profile", element: <ProfilePage /> },

          // Editor & Create (Wrapped so they get the sidebar too)
          { path: "/create", element: <Create /> },
          { path: "/editor/:doc_id", element: <Editor /> },

          // Chat Layout (Nested inside Main Layout)
          {
            path: "/chat",
            element: <Chat />,
            children: [{ path: ":userId", element: <ChatMember /> }],
          },
        ],
      },
    ],
  },

  // --- Fallback ---
  { path: "*", element: <NotFound /> },
]);

const App = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(checkAuth());
    dispatch(listenToMessages());
  }, [dispatch]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
