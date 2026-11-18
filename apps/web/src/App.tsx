import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useEffect } from "react";
import { Loader2 } from "@/components/icons";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { checkAuth } from "./store/slices/User";
import { queryClient } from "./api/queryClient";
import socket from "./utils/socket";

// --- Components & Pages ---
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import Editor from "./pages/Editor";
import Chat from "./pages/Chat";
import Team from "./pages/Team";
import NotFound from "./pages/NotFound";
import ProfilePage from "./pages/Profile";
import Create from "./pages/Create";
import RAGDocs from "./pages/RAGDocs";
import RAGDocDetail from "./pages/RAGDocDetail";
import ProtectedRoute, { RequireWorkspace } from "./components/ProtectedRoute";
import Onboarding from "./pages/Onboarding";
import InvitePage from "./pages/Invite";

const router = createBrowserRouter([
  // --- Public Routes (No Sidebar/Navbar) ---
  { path: "/", element: <Landing /> },
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/invite/:token", element: <InvitePage /> },

  // --- Private routes ---
  {
    element: <ProtectedRoute />,
    children: [
      // Logged in, but not in a workspace yet
      { path: "/onboarding", element: <Onboarding /> },
      {
        element: <RequireWorkspace />,
        children: [
          {
            element: <Layout />, // keeps the sidebar persistent
            children: [
              { path: "/dashboard", element: <Dashboard /> },
              { path: "/documents", element: <Documents /> },
              { path: "/team", element: <Team /> },
              { path: "/profile", element: <ProfilePage /> },
              { path: "/rag-docs", element: <RAGDocs /> },
              { path: "/rag-docs/:id", element: <RAGDocDetail /> },
              { path: "/create", element: <Create /> },
              { path: "/editor/:doc_id", element: <Editor /> },
              { path: "/chat/:conversationId?", element: <Chat /> },
            ],
          },
        ],
      },
    ],
  },

  // --- Fallback ---
  { path: "*", element: <NotFound /> },
]);

const App = () => {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.user.user?._id);
  const isAuthChecking = useAppSelector((s) => s.user.isAuthChecking);
  const workspaceId = useAppSelector((s) => s.user.workspace?._id);

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  useEffect(() => {
    // The socket authenticates with the session cookie and works in the
    // active workspace, so it reconnects whenever either changes.
    if (userId && workspaceId) {
      socket.disconnect().connect();
    } else {
      socket.disconnect();
    }
  }, [userId, workspaceId, dispatch]);

  if (isAuthChecking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950">
        <span className="text-lg font-bold tracking-tight text-white">
          Project Teams
        </span>
        <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
      </div>
    );
  }
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
