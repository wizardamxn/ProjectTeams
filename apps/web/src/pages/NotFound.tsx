import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Home } from "@/components/icons";
import { motion } from "framer-motion";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-zinc-950 px-4 text-center">
      <div className="bg-grid mask-radial-faded pointer-events-none absolute inset-0 opacity-30" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center"
      >
        <h1 className="text-[120px] font-bold leading-none text-gradient sm:text-[180px]">
          404
        </h1>
        <p className="mt-2 text-lg font-medium text-zinc-200">
          This page wandered off.
        </p>
        <p className="mt-2 max-w-sm text-sm text-zinc-500">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-emerald-500/30 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
