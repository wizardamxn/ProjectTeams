import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
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
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { addUser } from "./store/slices/User";
import axios from "axios";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/documents", element: <Documents /> },
  { path: "/create", element: <Create /> },
  { path: "/editor/:doc_id", element: <Editor /> },
  {
    path: "/chat",
    element: <Chat />,
    children: [{ path: ":userId", element: <ChatMember /> }],
  },
  { path: "/team", element: <Team /> },
  { path: "/profile", element: <ProfilePage /> },
  { path: "*", element: <NotFound /> },
]);

const App = () => {
  const dispatch = useDispatch();

  const getProfileData = async () => {
    try {
      const res = await axios.get("http://localhost:2222/profile", {
        withCredentials: true,
      });
      console.log(res.data);
      dispatch(addUser(res.data));
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

  useEffect(() => {
    getProfileData();
  }, []);

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
