import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "@/components/icons";
import { useAppSelector } from "@/store/hooks";

const FullScreenSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
    <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
  </div>
);

/** Logged-in users only. Others go to login and come back here afterwards. */
export default function ProtectedRoute() {
  const { user, isAuthChecking } = useAppSelector((s) => s.user);
  const location = useLocation();

  if (isAuthChecking) return <FullScreenSpinner />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

/** Users who are in a workspace. Everyone else is sent to create or join one. */
export function RequireWorkspace() {
  const workspace = useAppSelector((s) => s.user.workspace);
  if (!workspace) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
