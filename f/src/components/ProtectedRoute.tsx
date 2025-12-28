import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute() {
  const { user, isAuthChecking } = useSelector((state: any) => state.user);

  // 1. IF CHECKING: Show a generic loading screen. 
  // Do NOT redirect yet. Just wait.
  if (isAuthChecking) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#09090b]">
        <Loader2 className="w-10 h-10 animate-spin text-zinc-500" />
      </div>
    );
  }

  // 2. IF DONE CHECKING & NO USER: Now we can safely redirect.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. SUCCESS: Render the app
  return <Outlet />;
}